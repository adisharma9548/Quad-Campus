# STRICT FINAL AUDIT — REAL BROWSER TESTING, FUNCTIONALITY VERIFICATION & BUG FIXES

You have already implemented the universal profile system in my existing Quad application.

Now I want you to perform a complete quality-assurance audit of the actual running application.

**Do not assume your implementation is correct just because the code compiles or the page renders. I want you to open the application in your available browser, use it as a real user, test its functionality, identify everything broken, and fix it.**

This is a verification and correction task, NOT a redesign or a new implementation.

## 1. FIRST: Recheck All Previous Instructions

Before testing, revisit every requirement I provided earlier, including:

- The universal profile system.
- The distinction between my own profile and another user's profile.
- The supplied profile HTML design reference.
- Dynamic user-specific profile information.
- Posts, reels, and profile content sections.
- Follow, unfollow, and follow-request functionality.
- Privacy and visibility restrictions.
- Owner-only and visitor-only controls.
- Existing Quad application functionality.
- Branding, logo, colors, and theme preservation.
- Responsive layouts.
- Existing application architecture and routing.

Treat all my previous instructions as active requirements.

**Do not ignore, reinterpret, remove, or weaken any previous requirement while fixing issues.**

## 2. OPEN THE ACTUAL APPLICATION IN YOUR BROWSER

Start the application using its existing development environment.

Open the actual running application in your available browser.

Do not limit this task to reading source code, inspecting components, running a build, or checking screenshots.

You must interact with the rendered application.

Use browser interaction or available browser automation to:

- Click buttons.
- Open menus.
- Navigate between pages.
- Open different user profiles.
- Switch profile tabs.
- Scroll through profile content.
- Test follow interactions.
- Test available actions.
- Refresh pages.
- Test direct profile URLs.
- Check responsive layouts.
- Verify that the interface responds correctly to actual interactions.

Test the application from both perspectives:

**A. Profile Owner**
- Open my own profile.
- Verify owner-specific controls.
- Test editing and available management actions.
- Verify my posts, reels, drafts, and saved content.
- Verify all existing supported profile interactions.

**B. Profile Visitor**
- Open another user's profile.
- Verify that the correct person's information is displayed.
- Test follow and unfollow.
- Test follow requests and pending states.
- Verify message and sharing actions where available.
- Navigate through accessible posts and reels.
- Verify that owner-only controls are absent.
- Verify that restricted content cannot be accessed.

Also test different account relationships and privacy states wherever test accounts are available.

## 3. FUNCTIONALITY AUDIT

Test every relevant interactive element in the implemented profile system.

Check:

- Profile navigation.
- Profile URLs.
- Profile loading.
- Profile information retrieval.
- Profile statistics.
- Edit Profile.
- Follow and Unfollow.
- Follow requests.
- Message actions.
- Profile sharing.
- More Options menus.
- Posts tab.
- Reels tab.
- Saved content.
- Draft visibility.
- Content filters.
- Content sorting.
- Media previews.
- Content interactions.
- Privacy restrictions.
- Empty states.
- Loading states.
- Navigation between different users.

Do not simply verify that buttons are clickable.

Verify that clicking them produces the correct result, updates the actual application state, and communicates correctly with the existing backend where applicable.

Look for:
- Buttons that do nothing.
- Incorrect navigation destinations.
- Broken API requests.
- Incorrect user data.
- Stale profile information.
- Incorrect content counts.
- Non-functional dropdowns.
- Broken tabs.
- Incorrect permission checks.
- Duplicate actions.
- Incorrect follow states.
- Missing loading feedback.
- Broken empty states.
- Runtime errors.

## 4. VISUAL MATCHING AND DESIGN VERIFICATION

Compare the actual rendered profile page against the supplied HTML reference.

Check whether the implemented result genuinely follows the reference's:

- Overall layout.
- Three-column structure.
- Profile header arrangement.
- Information hierarchy.
- Statistics section.
- Action button placement.
- Content tabs.
- Reels grid.
- Content cards.
- Supporting sidebar.
- Spacing and alignment.
- Responsive proportions.

Do not claim that the design matches simply because similar components exist.

Inspect the rendered result and identify actual visual discrepancies.

However, remember the most important distinction:

**The reference supplies the layout and design structure, NOT its branding.**

My original Quad application must retain:

- Its existing logo.
- Its existing brand colors.
- Its existing light and dark themes.
- Its existing typography and design tokens.
- Its existing visual identity.

Do not introduce the reference's colors or branding while correcting visual mismatches.

Also verify that the implementation does not unnecessarily change the appearance of unrelated application pages.

## 5. PRIVACY AND SECURITY VERIFICATION

This is a critical part of the audit.

Test whether a visitor can access restricted information through:

- Direct profile URLs.
- Direct content URLs.
- Profile navigation.
- Browser refreshes.
- API requests.
- Manipulated identifiers.
- Restricted content endpoints.

Verify that:

- Drafts are visible only to their owners.
- Saved content remains private.
- Private profile content is protected.
- Followers-only content respects the actual follow relationship.
- Close Friends content respects approved membership.
- Blocked users cannot bypass restrictions.
- Owner-only actions cannot be performed by visitors.

Check backend authorization, not just frontend visibility.

Never expose private information in API responses simply because the frontend hides it.

Do not weaken existing security or privacy rules to make the interface work.

## 6. RESPONSIVE AND THEME TESTING

Use your browser to inspect the application at:

- Desktop resolution.
- Tablet resolution.
- Mobile resolution.

Verify:
- No horizontal overflow.
- No overlapping elements.
- No clipped profile information.
- Correct sidebar behavior.
- Proper content grid adaptation.
- Accessible buttons and controls.
- Correct mobile navigation.

Test both light and dark themes.

Do not fix responsive problems by removing existing functionality.

## 7. CHECK THE BROWSER CONSOLE AND NETWORK ACTIVITY

Inspect browser console errors and warnings.

Inspect failed network requests and relevant API responses.

Check for:
- JavaScript runtime errors.
- Failed API requests.
- Missing images.
- Broken media URLs.
- Authentication failures.
- Incorrect HTTP responses.
- React rendering issues.
- Invalid state updates.
- Duplicate network requests.
- CSS loading problems.
- Broken navigation routes.

Investigate the actual cause before fixing an issue.

Do not hide errors, suppress warnings, or use superficial workarounds that leave the underlying problem unresolved.

## 8. FIX EVERYTHING YOU FIND

This is not merely a report-generation task.

You must:

1. Identify each actual problem.
2. Determine its root cause.
3. Fix it directly in the existing codebase.
4. Reopen the relevant application page.
5. Repeat the failing interaction.
6. Verify that the problem is genuinely resolved.
7. Check that your correction did not break another existing feature.

Continue testing and correcting until all reasonably testable requirements pass.

Do not introduce new features, unnecessary redesigns, or unrelated refactoring.

Do not replace working implementations with mock functionality.

Do not use fake API responses to make tests pass.

Do not delete existing functionality to eliminate test failures.

If a test requires an unavailable account, backend service, or external dependency, clearly identify that limitation instead of pretending it passed.

Do not perform destructive tests against real user data or production accounts.

## 9. STRICT PRESERVATION RULE

All earlier instructions remain valid throughout this entire audit.

In particular:

- Do not redesign the profile page.
- Do not alter my logo.
- Do not change my brand colors.
- Do not replace my theme system.
- Do not break light or dark mode.
- Do not remove existing Quad functionality.
- Do not redesign unrelated pages.
- Do not change working backend functionality unnecessarily.
- Do not compromise privacy or security.
- Do not replace actual application data with sample content.

Only make changes necessary to correct verified bugs, functionality failures, integration issues, or discrepancies from my supplied design requirements.

## 10. FINAL VERIFICATION REPORT

After completing the audit and fixes, provide a report containing:

**A. Browser Testing**
- Which pages and profile states were opened.
- Which user interactions were tested.
- Which responsive sizes were checked.
- Whether light and dark themes work.

**B. Bugs Found and Fixed**
For each issue, explain:
- What was broken.
- What caused it.
- What you changed.
- How you verified the fix.

**C. Design Comparison**
Explain whether the final rendered profile implementation matches the supplied HTML reference structurally and visually, while retaining Quad's original branding.

Mention any remaining discrepancies honestly.

**D. Functionality Results**
Separate results into:
- Passed.
- Failed.
- Not tested due to unavailable dependencies or permissions.

**E. Final Build Verification**
Report the actual build and test results.

Do not claim that something works unless you have verified it.

## FINAL COMMAND

I expect you to behave like a real QA engineer using the application, not like a developer who merely reads their own code and declares it finished.

**Open the application. Use it. Test it. Break it through legitimate interactions. Find the problems. Fix them. Test again.**

Most importantly, remember all the requirements I gave you before this audit.

The final implementation must satisfy those original requirements, retain the existing Quad identity, and work correctly for both profile owners and visitors.

**Do not stop after finding bugs. Fix the bugs and verify the corrections in the browser.**
