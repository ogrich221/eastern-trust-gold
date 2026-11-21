<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep customer banking data in Lovable Cloud behind user-scoped access policies because financial profiles are sensitive.
- Use top-level public routes for banking content and the managed authenticated layout for customer-only pages.
- Admin portal (/admin) uses its own username/password login (ADMIN_USERNAME/ADMIN_PASSWORD secrets, HMAC-signed HttpOnly cookie), independent of customer accounts — owner wants staff access separate from customer email logins.

- Sitemap is router-derived: every route sets staticData.sitemap (true/false/"exclude-subtree") because the sitemap is generated from route decisions.

- Use `bank_accounts.is_active` and a partial unique index to distinguish usable accounts from archived records; preserve archived balances and ledger references instead of deleting financial history.
