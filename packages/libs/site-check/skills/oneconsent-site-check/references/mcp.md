# Catalogue, installation and live release

Identify the exact authorized app with `get_account_context` and `list_scoped_resources`. Ask the user to choose if multiple sites match.

For enrichment, use `read_services` with `kind: "catalog"`, the selected `appId`, and `input` containing the catalogue query. Search by service name or vendor when the evidence provides one. For hostname-only evidence, read a bounded set of authorized catalogue pages using `input.limit` and `input.offset`, then compare the hostname with returned domain patterns locally. Confirm the matched host boundary and any required path. Keep unmatched origins Unknown and report enrichments separately from the recorded browser evidence.

For an uninstalled site, start with `get_setup_plan` for the real platform. For React or Next.js, use `get_integration_recipe` and the stage-bound `get_integration_plan` with inspected project facts. For script-based installation, use the authorized snippet from `get_installation_context` and the Dashboard Install & verify flow. Retain blockers and get approval for any changes or publication required by those tools. Use an actual verification run to report successful installation.

For an installed React or Next.js site, use the live integration plan for the exact app. Compare its release references and declared services with the actual local browser observations. Other web sites need verified live release evidence from the Dashboard or runtime. `get_installation_context` provides draft configuration and delivery metadata, so use it to locate the app and deployment and keep the draft service list separate from live evidence. If access or an exact live release is unavailable, state that the comparison is unchecked.
