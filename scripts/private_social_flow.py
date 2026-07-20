from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from playwright.sync_api import Browser, BrowserContext, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

from supabase_challenge_flow import (
    BrowserDiagnostics,
    attach_diagnostics,
    load_root_env,
    open_app,
    require_environment,
    save_page_diagnostics,
    start_servers,
    stop_process,
)


ROOT = Path(__file__).resolve().parents[1]
PAGE_TIMEOUT_MS = 15_000


def expect_rpc(page: Page, rpc_name: str, action) -> None:
    with page.expect_response(
        lambda response: f"/rest/v1/rpc/{rpc_name}" in response.url,
        timeout=PAGE_TIMEOUT_MS,
    ) as response_info:
        action()
    response = response_info.value
    if response.status >= 400:
        raise RuntimeError(f"RPC {rpc_name} returned HTTP {response.status}.")
    page.wait_for_timeout(400)


def mobile_nav(page: Page, label: str) -> None:
    mobile = page.locator(".mobile-nav")
    if mobile.is_visible():
        mobile.get_by_role("button", name=label, exact=True).click()
    else:
        page.locator(".sidebar-nav").get_by_role("button", name=label, exact=True).click()


def finish_onboarding(page: Page, name: str) -> None:
    if not page.locator("#onboarding-language").count():
        page.locator(".app-shell").wait_for(timeout=PAGE_TIMEOUT_MS)
        return
    page.get_by_role("button", name="Continue", exact=True).click()
    page.locator("#onboarding-name").fill(name)
    page.get_by_role("button", name="Continue", exact=True).click()
    page.get_by_role("button", name="Continue", exact=True).click()
    page.get_by_role("button", name="Skip for now", exact=True).click()
    page.locator(".app-shell").wait_for(timeout=PAGE_TIMEOUT_MS)


def set_handle(page: Page, handle: str) -> None:
    mobile_nav(page, "Profile")
    page.get_by_role("button", name="Edit profile", exact=True).click()
    handle_label = page.locator("label.field-label").filter(has_text="Exact handle")
    if not handle_label.count():
        handle_label = page.locator("label.field-label").filter(has_text="Handle")
    handle_label.locator("input").fill(handle)
    social_panel = page.locator(".settings-section").filter(has_text="PRIVATE CONNECTIONS")
    save = social_panel.get_by_role("button", name="Save", exact=True)
    expect_rpc(page, "update_my_profile", save.click)
    page.get_by_role("heading", name="Settings.", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)


def open_friends(page: Page) -> None:
    heading = page.get_by_role("heading", name="Friends.", exact=True)
    if not heading.is_visible():
        with page.expect_response(
            lambda response: "/rest/v1/rpc/list_my_friendships" in response.url,
            timeout=PAGE_TIMEOUT_MS,
        ) as response_info:
            mobile_nav(page, "Friends")
    else:
        mobile_nav(page, "Friends")
    page.get_by_role("heading", name="Friends.", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)


def lookup_by_handle(page: Page, handle: str) -> None:
    lookup_row = page.locator(".friends-lookup-row")
    lookup_row.locator("input").fill(handle)
    expect_rpc(page, "lookup_profile_by_handle", lookup_row.get_by_role("button", name="Look up", exact=True).click)


def assert_no_server_secrets(page: Page) -> None:
    content = page.content().lower()
    for marker in ("service_role_key", "supabase_service_role_key", "database_password"):
        if marker in content:
            raise AssertionError(f"Browser content exposed a server secret marker: {marker}")


def complete_onboarding_context(page: Page, name: str) -> None:
    open_app(page, name)
    finish_onboarding(page, name)
    guide = page.get_by_role("dialog")
    if guide.count():
        guide.get_by_role("button", name="Got it", exact=True).click()
    assert_no_server_secrets(page)


def cleanup_context(page: Page) -> None:
    try:
        if not page.locator(".mobile-nav").count():
            return
        mobile_nav(page, "Profile")
        page.get_by_role("button", name="Edit profile", exact=True).click()
        delete_button = page.get_by_role("button", name="Delete my beta data", exact=True)
        if delete_button.count():
            delete_button.click()
            page.wait_for_timeout(1_000)
    except Exception:
        pass


def run_flow(env: dict[str, str], diagnostics_dir: Path) -> None:
    processes: list[tuple[object, object]] = []
    contexts: list[BrowserContext] = []
    pages: list[tuple[Page, BrowserDiagnostics]] = []
    browser: Browser | None = None
    failure: Exception | None = None
    suffix = str(int(time.time()))[-7:]
    handle_a = f"flowa{suffix}"
    handle_b = f"flowb{suffix}"
    group_name = f"Private Flow Group {suffix}"

    try:
        processes, health = start_servers(env, diagnostics_dir)
        if health.get("persistence") != "supabase":
            raise RuntimeError(f"Expected Supabase persistence, got {health.get('persistence')}")
        print("PRIVATE_SOCIAL_PLAYWRIGHT_SERVER_OK active_backend=supabase")

        playwright = sync_playwright().start()
        try:
            browser = playwright.chromium.launch(headless=True)
            for name in ("Flow A", "Flow B", "Flow C"):
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                contexts.append(context)
                page = context.new_page()
                diagnostics = BrowserDiagnostics()
                attach_diagnostics(page, diagnostics)
                page.on("dialog", lambda dialog: dialog.accept())
                pages.append((page, diagnostics))
                complete_onboarding_context(page, name)

            page_a, _ = pages[0]
            page_b, _ = pages[1]
            page_c, _ = pages[2]

            set_handle(page_a, handle_a)
            set_handle(page_b, handle_b)

            # A finds B through an exact normalized handle and sends a request.
            open_friends(page_a)
            lookup_by_handle(page_a, handle_b)
            result_card = page_a.locator(".friend-preview").filter(has_text=f"@{handle_b}")
            result_card.wait_for(timeout=PAGE_TIMEOUT_MS)
            expect_rpc(page_a, "send_friend_request", result_card.get_by_role("button", name="Send request", exact=True).click)

            # B accepts the incoming request.
            open_friends(page_b)
            incoming_card = page_b.locator(".friend-preview").filter(has_text=f"@{handle_a}")
            incoming_card.wait_for(timeout=PAGE_TIMEOUT_MS)
            expect_rpc(page_b, "update_friend_request", incoming_card.get_by_role("button", name="Accept", exact=True).click)

            # A creates an asynchronous direct challenge and B opens/completes it.
            open_friends(page_a)
            friend_card = page_a.locator(".friend-preview").filter(has_text=f"@{handle_b}")
            friend_card.get_by_role("button", name="Challenge", exact=True).click()
            modal = page_a.locator(".modal-card")
            modal.locator("textarea").fill("A direct challenge opening argument with enough detail for the private flow.")
            expect_rpc(page_a, "create_friend_challenge", modal.get_by_role("button", name="Send challenge", exact=True).click)

            open_friends(page_b)
            page_b.get_by_role("heading", name="Friend challenges", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            page_b.get_by_role("button", name="Answer", exact=True).first.click()
            answer_box = page_b.locator(".friend-answer textarea")
            answer_box.fill("A considered response that engages the original argument and explains a different trade-off.")
            expect_rpc(page_b, "complete_friend_challenge", page_b.get_by_role("button", name="Submit response", exact=True).click)

            open_friends(page_a)
            page_a.get_by_text("completed", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)

            # A creates a private Group, invites B through the accepted-friend card, and B accepts.
            mobile_nav(page_a, "Groups")
            page_a.get_by_role("heading", name="Groups.", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.get_by_role("button", name="Create a group", exact=True).click()
            page_a.get_by_label("Group name", exact=True).fill(group_name)
            page_a.get_by_label("Short description", exact=True).fill("A private browser-flow room.")
            expect_rpc(page_a, "create_group", page_a.get_by_role("button", name="Create private group", exact=True).click)
            page_a.get_by_role("heading", name=re.compile(re.escape(group_name))).wait_for(timeout=PAGE_TIMEOUT_MS)

            open_friends(page_a)
            friend_card = page_a.locator(".friend-preview").filter(has_text=f"@{handle_b}")
            friend_card.get_by_role("button", name="Invite to Group", exact=True).click()
            invite_modal = page_a.locator(".modal-card")
            invite_modal.locator("select").select_option(label=group_name)
            expect_rpc(page_a, "create_group_friend_invitation", invite_modal.get_by_role("button", name="Invite to Group", exact=True).click)

            open_friends(page_b)
            page_b.get_by_role("heading", name="Group invitations", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            invite = page_b.locator(".friend-preview").filter(has_text=group_name)
            expect_rpc(page_b, "respond_group_friend_invitation", invite.get_by_role("button", name="Join Group", exact=True).click)

            # C has no relationship visibility and no private Group membership/data.
            open_friends(page_c)
            if page_c.locator(".friend-preview").filter(has_text=f"@{handle_a}").count():
                raise AssertionError("Outsider C could inspect A's private relationship preview")
            mobile_nav(page_c, "Groups")
            page_c.get_by_role("heading", name="Groups.", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            if page_c.get_by_text(group_name, exact=True).count():
                raise AssertionError("Outsider C could inspect the private Group")

            # A blocks B. The relationship card disappears and B receives only neutral unavailable state.
            open_friends(page_a)
            friend_card = page_a.locator(".friend-preview").filter(has_text=f"@{handle_b}")
            expect_rpc(page_a, "block_user", friend_card.get_by_role("button", name="Block", exact=True).click)
            page_a.get_by_role("heading", name="Blocked users", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.get_by_text(f"@{handle_b}", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)

            open_friends(page_b)
            lookup_by_handle(page_b, handle_a)
            page_b.get_by_text("No matching profile is available.", exact=True).wait_for(timeout=PAGE_TIMEOUT_MS)
            if page_b.get_by_role("button", name="Challenge", exact=True).count() or page_b.get_by_role("button", name="Invite to Group", exact=True).count():
                raise AssertionError("Blocked user retained direct challenge or Group invitation actions")
            if page_b.get_by_role("heading", name="Group invitations", exact=True).count():
                raise AssertionError("Blocked user retained a Group invitation inbox")

            for page, _diagnostics in pages:
                assert_no_server_secrets(page)
                page.set_viewport_size({"width": 320, "height": 900})
                if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"):
                    raise AssertionError("Private social flow has horizontal overflow at 320px")
        except Exception as error:
            failure = error
            raise
        finally:
            if failure is not None:
                for index, (page, _diagnostics) in enumerate(pages, start=1):
                    save_page_diagnostics(page, f"page-{index}", diagnostics_dir)
            for page, _diagnostics in pages:
                cleanup_context(page)
            if browser is not None:
                browser.close()
            playwright.stop()
    except Exception as error:
        failure = error
    finally:
        for process, log_handle in reversed(processes):
            stop_process(process, log_handle)

    if failure is not None:
        print(f"PRIVATE_SOCIAL_PLAYWRIGHT_FAILED: {failure}")
        print(f"PRIVATE_SOCIAL_PLAYWRIGHT_DIAGNOSTICS: {diagnostics_dir}")
        raise SystemExit(1)

    print("PRIVATE_SOCIAL_PLAYWRIGHT_OK users=3 exact_handle=request_accept=challenge_completed=group_invite_accept outsider_denied=blocked_neutral_actions")


def main() -> int:
    env_values = load_root_env()
    child_env = require_environment(env_values)
    if not child_env:
        return 2
    diagnostics_dir = Path(__import__("tempfile").mkdtemp(prefix="sideshift-private-social-playwright-"))
    run_flow(child_env, diagnostics_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
