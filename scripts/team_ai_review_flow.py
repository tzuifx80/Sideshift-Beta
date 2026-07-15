import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        page.get_by_label("Display name").or_(page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI"))).first.wait_for(timeout=30_000)
        if page.get_by_label("Display name").count():
            page.get_by_label("Display name").fill("AI Team Facilitator")
            page.get_by_role("button", name="Ethics and Philosophy", exact=True).click()
            page.get_by_role("button", name="School and Education", exact=True).click()
            page.get_by_role("button", name="Enter the arena", exact=True).click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI\."), exact=False).wait_for(timeout=10_000)
        if page.get_by_role("dialog").count():
            page.get_by_role("dialog").get_by_text("Got it", exact=True).click()

        page.locator(".sidebar .nav-item").filter(has_text="Team Debate").click()
        page.get_by_role("heading", name="Team Debate.").wait_for()
        page.get_by_label("Private custom topic").fill("Schools should start later")
        page.locator(".team-setup-options input[type='number']").first.fill("1")
        page.locator(".team-setup-options select").select_option("ai")
        page.get_by_role("button", name=re.compile(r"Start Team Debate")).click()
        page.get_by_text("CURRENT TEAM", exact=True).wait_for()
        for index in range(2):
            page.locator(".team-composer textarea").fill(f"This is a bounded team argument for review turn {index + 1}.")
            page.get_by_role("button", name="Submit turn", exact=True).click()
            if index == 0:
                page.get_by_text("CURRENT TEAM", exact=True).wait_for()
        page.locator(".team-ai-review .eyebrow").filter(has_text="AI feedback selected").wait_for(timeout=10_000)
        page.get_by_text("Technique, not ideology", exact=True).wait_for(timeout=10_000)
        page.locator(".team-review-grid article").first.wait_for(timeout=10_000)
        if page.locator(".team-review-grid article").count() != 2:
            raise AssertionError("AI team review did not score every team")
        if errors:
            raise AssertionError(f"Browser errors: {errors}")
        print("TEAM_AI_REVIEW_FLOW_OK teams=2 bounded_review=true")
        browser.close()


if __name__ == "__main__":
    main()
