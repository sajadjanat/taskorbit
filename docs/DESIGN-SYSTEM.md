# Interface foundation

TaskOrbit keeps its Mercury identity across connection, sign-in, setup and the workspace. Entry pages share `EntryShell`; form controls come from the existing shadcn/ui components.

## Tokens

| Role           | Light           | Dark                 |
| -------------- | --------------- | -------------------- |
| Page           | `#f6f4f0` stone | `#171615` charcoal   |
| Surface        | `#ffffff`       | `#22201e`            |
| Text           | `#292524`       | `#f0eae0`            |
| Secondary text | `#686159`       | `#b6aea3`            |
| Accent         | `#7d4b0b` amber | `#e9b75f` solar gold |
| Border         | `#ddd6cc`       | `#40392f`            |

The typeface is bundled Vazirmatn for Latin/Arabic script, with system fallbacks for Chinese. Entry body and inputs use 14–16 px; form titles use 26 px and the desktop introduction uses 38 px. Line heights range from 1.4 for headings to 1.7 for supporting copy. Text is aligned to the current locale direction.

Spacing follows 4/8/12/16/24/32/48 px. Entry inputs and primary actions have a minimum 44 px height. Forms use a consistent 420 px maximum width, 16 px field spacing and visible labels. The page header holds branding and language/appearance controls; the footer holds the version and getting-started link.

## Entry layout

```text
Logo                                      Language / Theme

Mercury artwork                           Form heading
Product purpose                           Supporting instruction
Projects / Sprints / Team                  Label + input
                                          Primary action
                                          Optional compact updates

Version                                   Getting started
```

The distinctive visual is the approved transparent Mercury artwork. Supporting layout stays quiet: one form surface, no nested update card, no fake metrics or decorative feature cards. On narrow screens the introduction is hidden and the form uses the available width; the header and primary form remain visible.

## Interaction rules

Version 0.2.0 adds a search command dialog, inbox, import review, bulk selection and sprint reports using the same palette, typography and spacing. Dialog text and close controls follow locale direction; mobile dialogs scroll within the viewport. Cards use the existing quiet border token rather than a foreground-colored outline.

The empty-project illustration is an AI-generated transparent Mercury sphere with three fine solar-gold orbits, based on the approved `public/icon-512.png` brand reference. Source: `assets/brand/onboarding-orbit.png`; optimized transparent 512 px WebP: `public/onboarding-orbit.webp`. Prompt: quiet rocky Mercury, sunlight from the upper-left, thin elliptical paths and restrained gold markers, no text, UI, logos or people. It is decorative, has an empty alternative text, and accompanies a real next-step action. It is not used for task status or data.

- A new or invalid locale preference starts in English. Valid saved language choices are respected; Persian and Arabic use RTL, while URL/email fields remain LTR.
- Inputs have appropriate types, autocomplete and persistent labels. Passwords can be shown or hidden without clearing their value.
- Forms expose busy state and disable duplicate submission. Field hints and errors are associated with inputs; status/error messages use live-region semantics.
- Keyboard focus remains visible. Theme transitions respect reduced motion. Controls retain contrast in both themes.
- Connection updates are a compact disclosure below the form. Update availability remains visible, while detail and actions can expand without dominating the entry page.
