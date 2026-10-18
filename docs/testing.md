# Testing

Public CI checks JavaScript syntax, manifest/version consistency, the exact release archive allowlist, source/archive byte parity and checksums. These checks do not launch Foundry or establish gameplay compatibility.

Before initial publication,83 native assertions passed across the main workflow, edge/UI and Reload0 suites on Foundry14.369/PF2e8.6.0. They exercised actual character sheets, chat controls, native ammunition operations and GM/player clients in an isolated licensed installation. Test worlds, actor exports and licensed packs are private and are not included in this repository.

Useful gameplay regression scenarios:

- Switch ordinary/special ammunition outside combat; total loaded plus reserve quantities must be conserved.
- In combat, change the preferred ammo while keeping the current round loaded, fire it, and reload through chat without another routine card.
- Roll damage/critical from the earlier attack card after loading a different round; preserve the fired round's rules.
- Load the final reserve round, then deplete it; offer compatible alternatives without duplicate prompts.
- Check one-round combat reloads versus filling all double-barrel/capacity slots outside combat.
- Load and fire a partially depleted magazine without restoring uses.
- Test concurrent owner requests, nonowner rejection, unlinked tokens and a connected owner with no active GM.
- End one of two encounters involving the same actor; automatic loading must wait for the final encounter to end.
- With ignore mode on, fire an empty weapon with no ammunition inventory and verify inventory remains unchanged. Turn it off and restore native enforcement.
- Fire shortbows, longbows and repeating Reload0 crossbows repeatedly inside/outside combat: one native attack card per shot, no Reload controls or extra reload/depletion cards, normal ammunition consumption.

Third-party module interactions and browser versions require their own checks. A passing count for these scenarios does not certify every weapon, feat combination, or external module.
