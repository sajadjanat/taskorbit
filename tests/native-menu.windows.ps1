param([int]$TaskProcessId)
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public class TaskOrbitMenu {
 public delegate bool Callback(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback c,IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr m);
 [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr m,int n);
 [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr m,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr m,uint n,StringBuilder s,int max,uint flags);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint message,UIntPtr w,IntPtr l);
}
'@
$script:taskHandle=[IntPtr]::Zero
[void][TaskOrbitMenu]::EnumWindows({param($h,$l) $taskPid=[uint32]0; [void][TaskOrbitMenu]::GetWindowThreadProcessId($h,[ref]$taskPid); if($taskPid -eq $TaskProcessId -and [TaskOrbitMenu]::GetMenu($h) -ne [IntPtr]::Zero){$script:taskHandle=$h};return $true},[IntPtr]::Zero)
function Find-TaskMenu([IntPtr]$menu) {
 for($i=0;$i -lt [TaskOrbitMenu]::GetMenuItemCount($menu);$i++) {
  $s=[Text.StringBuilder]::new(300); [void][TaskOrbitMenu]::GetMenuString($menu,$i,$s,300,0x400)
  if($s.ToString() -like '*Server connection*') { return [TaskOrbitMenu]::GetMenuItemID($menu,$i) }
  $sub=[TaskOrbitMenu]::GetSubMenu($menu,$i)
  if($sub -ne [IntPtr]::Zero) { $found=Find-TaskMenu $sub; if($null -ne $found) { return $found } }
 }
}
$taskCommand=Find-TaskMenu ([TaskOrbitMenu]::GetMenu($taskHandle))
if($null -eq $taskCommand) { throw 'Native Connection menu was not found' }
[void][TaskOrbitMenu]::PostMessage($taskHandle,0x111,[UIntPtr]::new($taskCommand),[IntPtr]::Zero)
Write-Output 'Invoked the real native Connection menu.'
