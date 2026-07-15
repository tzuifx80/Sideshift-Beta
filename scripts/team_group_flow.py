import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_timeout(500)

        if page.get_by_label("Display name").count():
            page.get_by_label("Display name").fill("Team Facilitator")
            page.get_by_role("button", name="Enter the arena", exact=True).click()
        page.get_by_text("Good morning, Team").wait_for(timeout=10_000)
        if page.get_by_role("dialog").count():
            page.get_by_role("dialog").get_by_text("Got it", exact=True).click()

        page.locator(".sidebar-nav").get_by_role("button", name="Groups", exact=True).click()
        page.get_by_role("heading", name="Groups.").wait_for()
        page.get_by_role("button", name="Create a group", exact=True).click()
        page.get_by_label("Group name").fill("Thursday Debate Club")
        page.get_by_label("Short description").fill("A private room for careful disagreements.")
        page.get_by_role("button", name="Create private group", exact=True).click()
        page.get_by_role("heading", name="✦ Thursday Debate Club.").wait_for()

        page.get_by_role("button", name="Create invite", exact=True).click()
        page.locator(".group-invite-box strong").wait_for()
        invite_code = page.locator(".group-invite-box strong").inner_text()
        if not invite_code.startswith("SS-"):
            raise AssertionError("Invite code was not generated in the private group")

        page.get_by_label("Statement").fill("Schools should start later")
        page.get_by_label("Neutral context").fill("A motion for a balanced classroom discussion.")
        page.get_by_role("button", name="Save group topic", exact=True).click()
        page.get_by_text("Schools should start later", exact=True).wait_for()
        page.locator(".group-topic-card .round-arrow").click()
        page.get_by_role("heading", name="Team Debate.").wait_for()
        if page.locator("#team-custom-topic").input_value() != "Schools should start later":
            raise AssertionError("Group topic was not preserved when entering Team Debate")

        page.get_by_text("Standard debate", exact=True).click()
        page.get_by_role("button", name="Start Team Debate →", exact=True).click()
        page.get_by_text("CURRENT TEAM", exact=True).wait_for()
        if page.get_by_role("button", name=re.compile(r"Voice (input|unavailable)"), exact=True).count() != 1:
            raise AssertionError("Team Debate did not expose the optional voice capability state")
        for index in range(4):
            page.locator(".team-composer textarea").fill(f"This team gives a clear, respectful argument for turn {index + 1}.")
            page.get_by_role("button", name="Submit turn", exact=True).click()
            if index < 3:
                page.get_by_role("button", name="Submit turn", exact=True).wait_for()
                page.wait_for_timeout(80)
        page.get_by_text("Good work in the room.").wait_for(timeout=10_000)
        if page.locator(".team-transcript-card article").count() != 4:
            raise AssertionError("Team transcript did not retain all four turns")

        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        page.get_by_text("Good work in the room.").wait_for(timeout=10_000)
        page.locator(".sidebar-nav").get_by_role("button", name="Groups", exact=True).click()
        page.get_by_role("heading", name="Groups.").wait_for()
        page.get_by_role("button", name="Thursday Debate Club", exact=False).click()
        page.get_by_text("Constructive points", exact=True).wait_for()
        if page.locator(".leaderboard-row strong").first.inner_text() != "20":
            raise AssertionError("Completed group Team Debate did not award exactly one participation update")

        for width in (320, 375, 390, 768, 1280):
            page.set_viewport_size({"width": width, "height": 900})
            overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            if overflow:
                raise AssertionError(f"Horizontal overflow at {width}px")

        if errors:
            raise AssertionError(f"Browser console errors: {errors}")
        print(f"TEAM_GROUP_FLOW_OK invite={invite_code[:8]}... turns=4 points=20")
        browser.close()


if __name__ == "__main__":
    main()
