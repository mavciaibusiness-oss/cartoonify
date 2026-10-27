# Queued for the next system release - apply with `/mavci-core:retro --apply`

Recorded: 2026-10-27, plugin 0.1.36, project cartoonify.

Each finding below was filed from inside a project, by whoever hit it, at the moment
they hit it. Nothing here is fixed. `/mavci-core:retro --apply` carries this file into
the system repository; only an operator can run that, and only an operator can delete
this file.

---

# Finding 1 - Live catalog check asserts on a SQL comment that MCP apply strips

Filed: 2026-10-27T19:09:29Z, plugin 0.1.36.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `supabase/checks/0024_live_catalog.sql:139 (instance); architect live-check authoring guidance (cause)`

Task 0024. supabase/checks/0024_live_catalog.sql (written by the architect into the spec's live-check block) asserts the re-created functions with: pg_get_functiondef(to_regprocedure('protoolhub.' || x.n)) not like '%0024 guard start%'. The operator applied migration 20261029000000_protoolhub_account.sql through Supabase MCP (apply_migration, named cartoonify_20261029000000_protoolhub_account). The read-only check then returned 2 rows instead of 0: 'polar_order_paid or polar_reconcile lacks the 0024 guard: polar_order_paid(text,text,text,text,text,integer,text)' and '... polar_reconcile(text)'. Read-only probe of the live bodies: position('--' in pg_get_functiondef) = 0 for all four 0024 functions, i.e. every -- comment was stripped on apply, while 'account_deleted' and 'user_id is null' were present. Comparing live pg_proc.prosrc with the file bodies after removing -- comments and collapsing whitespace: SAME for polar_reconcile, polar_order_paid, delete_account, account_overview. So the code is exactly the migration and the check failed on a comment. Any live check keyed on a comment marker will false-fail on every MCP-applied migration; the operator then has to judge a red check by hand, which trains them to ignore it.

### The assertion, and the broken build it must catch

A live-check assertion must hold on a database where the migration was applied with all SQL comments removed. Concretely: apply the migration with every -- comment stripped (the MCP apply path) to PGlite, run the live check, and require 0 rows; and apply the 0023-era (pre-guard) function bodies, run it again, and require the 'lacks the guard' rows. The broken build it must catch: a check that greps pg_get_functiondef for a comment marker - it returns rows on the stripped-but-correct database (false failure), which this assertion turns red. Prefer asserting on code tokens (e.g. 'v_co.user_id is null' and 'account_deleted') or on a comment-and-whitespace-normalised comparison of prosrc with the migration body.

---

# Finding 2 - Legal page finder cannot see pages under a locale folder (app/(tr)/tr/...)

Filed: 2026-10-27T20:33:40Z, plugin 0.1.36.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `scripts/rules/index.mjs findPage (line 600), used by legal.pages_present (616) and legal.kvkk_structure (709)`

Task 0025 moves Turkish pages to the /tr address prefix with a real folder: app/(tr)/tr/(legal)/privacy/page.tsx etc. scripts/rules/index.mjs:600 findPage(files, slug) uses new RegExp('^(?:src/)?app/(?:\([^/]+\)/)*' + slug + '/page\.(tsx|ts|jsx|js|mdx)$'): only route-group segments may sit between app/ and the slug, so app/(tr)/tr/(legal)/privacy/page.tsx never matches. Consequences seen in 0025: (1) the architect had to keep KVKK at app/(tr)/(legal)/kvkk/page.tsx and serve /tr/kvkk through a middleware rewrite, because moving it under tr/ would make legal.pages_present report 'required page "kvkk" does not exist' (blocker) on every turn and switch off legal.kvkk_structure (index.mjs:709, findPage(ctx.files,'kvkk')); (2) findPage returns only the FIRST match (files.find), so with an English page at app/(en)/(legal)/privacy/page.tsx and a Turkish one under app/(tr)/tr/(legal)/privacy/page.tsx, only one language is checked for content and the REVIEW REQUIRED marker; the other language's legal page is invisible to the checker. A locale prefix folder is the standard App Router i18n layout, so this hits every bilingual project.

### The assertion, and the broken build it must catch

Fixture tree with app/(en)/(legal)/privacy/page.tsx (real content) and app/(tr)/tr/(legal)/privacy/page.tsx (empty placeholder), and app/(tr)/tr/(legal)/kvkk/page.tsx with the seven KVKK sections: legal.pages_present must find kvkk (no 'does not exist'), must check EVERY match per slug, and must flag the empty Turkish privacy page. Broken build it catches: the current findPage, which reports kvkk missing and passes the bilingual pair because it only looks at the first match. Also assert app/tr/privacy/page.tsx (plain locale folder, no groups) and app/[locale]/privacy/page.tsx are found.
