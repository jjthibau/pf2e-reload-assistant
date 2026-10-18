# PF2e Reload Assistant

Default ammunition, automatic loading outside encounters, and quiet Reload buttons on native PF2e Strike cards.

Tested on **Foundry VTT14.369 and PF2e8.6.0**. Original MIT-licensed module. No runtime AI, external service, or module dependency is required.

## Install

In Foundry Setup, open **Add-on Modules → Install Module** and paste this manifest URL:

```text
https://github.com/jjthibau/pf2e-reload-assistant/releases/latest/download/module.json
```

Enable **PF2e Reload Assistant** in your world's Manage Modules window. Future Foundry module update checks use the same GitHub release source.

## Use

- Choose default ammunition in each reloadable weapon's ammo panel.
- Outside combat, automatically fill weapons from their defaults. Changing the default returns loaded rounds before loading the new choice.
- In combat, choose the next ammunition without changing already loaded rounds. Use Reload on the attack card to load one round or magazine without another routine chat message.
- Exhaustion cards offer compatible alternatives; choosing one sets the default and reloads.
- Ignore reloading and ammunition (world setting, default off) allows firing without ammunition, consumes nothing and suppresses reload automation/prompts.

Normal action costs remain the table's responsibility. The button displays the weapon's reload cost. Native PC inventory weapons are the initial target; NPC attack-item mapping and compound gunslinger reload actions are separate integrations. Ranged Combat compatibility is not assumed.

Ordinary Reload0 bows retain their native ammunition selector and receive no Reload buttons or extra chat cards. Repeating Reload0 weapons can have a default magazine; individual shots do not post reload prompts.

For tables ignoring ammunition entirely, enable **Configure Settings → PF2e Reload Assistant → Ignore reloading and ammunition**. This setting defaults off. With it on, missing ammunition never blocks a native PC weapon Strike, ammunition is not consumed, and reload automation/prompts stop.

## Scope and compatibility

Targets native **character inventory weapons**. NPC attack-item mapping, compound gunslinger reload actions, jams, and unusual additional cocking mechanics are not automated. Existing poison effects remain in place; ammunition names do not create poison effects or track poison charges. Compatibility with Ranged Combat and other modules replacing ammunition/damage pipelines requires separate testing.

Native tests cover quantity conservation, owner permissions/concurrent requests, depleted defaults, fired-ammunition damage preservation, ignore mode, encounter end, double barrels, partial magazines, multiple encounters, unlinked tokens and Reload0 weapons. See [testing](docs/testing.md) and [architecture](docs/architecture.md).

## Development

Run `npm test`, `npm run build`, and `npm run check:release` with Node24 and Python3.10+. Public checks validate syntax and release packaging; gameplay tests require an isolated, licensed Foundry installation.

Release archives contain only the original runtime and public documentation. Licensed Foundry/PF2e content, campaign exports, copied actors, private screenshots and operational files are excluded. See [contributing](CONTRIBUTING.md), [security](SECURITY.md), and [license](LICENSE).
