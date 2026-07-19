import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")
        if page.locator(".onboarding-page").count():
            page.get_by_role("button", name="Continue", exact=True).click()
            page.locator("#onboarding-name").fill("Explore Tester")
            page.get_by_role("button", name="Ethics and Philosophy", exact=True).click()
            page.get_by_role("button", name="Continue", exact=True).click()
            page.get_by_role("button", name="Continue", exact=True).click()
            page.get_by_role("button", name="Skip for now", exact=True).click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Explore\."), exact=False).wait_for(timeout=10_000)
        if page.get_by_role("dialog").count():
            page.get_by_role("dialog").get_by_text("Got it", exact=True).click()

        page.get_by_role("button", name="Explore", exact=True).first.click()
        page.get_by_text("THE TAKE LIBRARY", exact=True).wait_for()
        page.get_by_role("button", name="Another take", exact=True).click()
        spotlight = page.locator(".explore-spotlight h2")
        spotlight.wait_for()
        selected_motion = spotlight.inner_text()
        page.get_by_role("button", name="Start this take", exact=True).click()
        page.get_by_text("CHOOSE YOUR DEBATE MODE", exact=True).wait_for()
        if selected_motion not in page.locator(".debate-choice-page").inner_text():
            raise AssertionError("The selected Explore take was not preserved in debate choice.")
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP", exact=True).wait_for()
        if page.locator(".ai-motion-copy").inner_text() != selected_motion:
            raise AssertionError("The selected Explore take was not preserved in AI setup.")
        page.reload(wait_until="networkidle")
        page.get_by_text("AI DEBATE SETUP", exact=True).wait_for()
        if page.locator(".ai-motion-copy").inner_text() != selected_motion:
            raise AssertionError("AI setup did not restore its selected take after refresh.")
        if errors:
            raise AssertionError(f"Browser errors: {errors}")
        print("EXPLORE_AI_FLOW_OK")
        browser.close()


if __name__ == "__main__":
    main()
