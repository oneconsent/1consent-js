# 1Consent Site Check

This command runs the versioned 1Consent site check in Chrome on your machine. It opens fresh visitor contexts for Before choice, After Reject, After Accept, and Global Privacy Control. The executable writes a JSON report to stdout. The browser visits the target and its resources as a normal visitor would. The runner uploads no report to 1Consent.

## Requirements

Node.js 24.15 or newer and a local Chrome installation. Supply a public HTTP or HTTPS address and allow the command to launch a temporary browser profile.

```sh
oneconsent-site-check https://example.com
oneconsent-site-check --version
```

The report covers a sample of up to five public pages. It describes observed technical risk and the limits of the evidence. It is not legal advice or a compliance verdict. Recognized service names come from the built-in fingerprints documented below. Other services remain Unknown. Even at the same URL, geography, timing, available signals, and catalogue coverage can affect findings.

## Use with an assistant

Copy the entire packaged `skills/oneconsent-site-check` folder into the appropriate project directory. Open a fresh assistant session in that project and ask it to check a public URL using the skill. If its shell sandbox blocks Chrome, approve only the requested checker command through the client’s normal approval prompt.

| Client | Project directory |
| --- | --- |
| Claude Code | `.claude/skills/` |
| Codex | `.agents/skills/` |
| Cursor | `.cursor/skills/` |

Other assistants can use the [portable instructions](skills/oneconsent-site-check/references/generic-prompt.md) with the same local command. The skill can consult the connected `oneconsent` MCP server for optional catalogue enrichment or installation guidance with your approved app access.

## Built-in fingerprints

The executable uses a small independent set of browser signals based on published documentation. It shares the browser, report evaluator, and specification with the hosted checker.

- Analytics collection hosts and the `_ga` cookie family. [Google Analytics network troubleshooting](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot), [Google Analytics tagging](https://developers.google.com/analytics/devguides/collection/ga4/tag-options)
- DoubleClick advertising and the Google Ads conversion path. [Google advertising cookies](https://support.google.com/adsense/answer/7549925), [Google Ads conversion verification](https://support.google.com/google-ads/answer/13262500)
- reCAPTCHA endpoint paths. [reCAPTCHA FAQ](https://developers.google.com/recaptcha/docs/faq/)

## Versions

The npm version tracks the packaged runner and skill instructions. The report's `specVersion` identifies the shared check definitions. A change to the meaning of a check requires a shared specification version change in both runners. Browser execution or fingerprint updates can ship independently, with changed coverage documented in the release.
