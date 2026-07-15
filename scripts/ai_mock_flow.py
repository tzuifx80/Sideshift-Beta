import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"
ARGUMENTS = [
    "A clear rule helps people plan around a shared expectation while leaving room for careful exceptions.",
    "The strongest counterpoint is autonomy, but autonomy also depends on fair and understandable defaults.",
    "I would revise my view if a reliable comparison showed the rule caused more harm than the problem it addresses.",
    "The best case against my side is that one rule can hide important differences between people and situations.",
]


def send_argument(page, text):
    page.get_by_label("Your AI debate argument").fill(text)
    page.get_by_role("button", name="Send argument", exact=True).click()
    page.locator(".ai-turn.opponent").last.wait_for(timeout=10_000)


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")

        if page.get_by_label("Display name").count():
            page.get_by_label("Display name").fill("AI Integration Tester")
            page.get_by_role("button", name="Enter the arena").click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI\."), exact=False).wait_for(timeout=10_000)
        if page.get_by_role("dialog").count():
            page.get_by_role("dialog").get_by_text("Got it", exact=True).click()
        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.get_by_text("CHOOSE YOUR DEBATE MODE", exact=True).wait_for()
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP").wait_for()
        if page.locator(".opponent-card:disabled").count() == 0:
            raise AssertionError("Unavailable opponent state was not rendered before Puter connection.")

        page.locator(".ai-setup-page .back-link").click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI\."), exact=False).wait_for()
        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.locator(".debate-choice-person").click()
        page.get_by_text("FRIEND CLASH", exact=True).wait_for()
        page.locator(".clash-copy h1").wait_for()
        if page.locator(".ai-connection-card").count() != 0 or page.get_by_text("Activate mock AI", exact=True).count() != 0:
            raise AssertionError("Human challenge flow exposed the Puter connection prompt.")

        page.locator(".clash-page > .back-link").click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI\."), exact=False).wait_for()
        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP").wait_for()
        page.get_by_role("button", name="Activate mock AI", exact=True).click()
        page.get_by_text("Connected", exact=True).wait_for(timeout=10_000)
        page.get_by_text("Compatible live model available").wait_for(timeout=10_000)
        page.get_by_label("Theme").count()
        page.locator(".ai-setup-page .back-link").click()
        page.locator(".sidebar-nav").get_by_role("button", name="Profile", exact=True).click()
        page.get_by_role("button", name="Edit profile", exact=True).click()
        page.get_by_label("Theme").select_option("dark")
        page.locator(".accent-option.accent-cyan").click()
        page.get_by_label("Preferred opponent").select_option("ask")
        page.get_by_label("AI family").select_option("GPT")
        page.get_by_label("Model quality").select_option("maximum")
        page.get_by_label("Response length").select_option("detailed")
        page.get_by_text("Show model details during AI debates", exact=True).click()
        page.get_by_role("button", name="Save", exact=True).last.click()
        page.get_by_text("Settings saved privately.").wait_for()
        page.locator(".settings-page .settings-footer .back-link").click()
        page.locator(".sidebar-nav").get_by_role("button", name="Home", exact=True).click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), AI\."), exact=False).wait_for()
        if page.locator("html[data-theme='dark']").count() != 1 or page.locator("html[data-accent='cyan']").count() != 1:
            raise AssertionError("Dark theme or cyan accent did not persist.")
        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP").wait_for()
        page.get_by_text("Advanced model settings", exact=True).click()
        page.get_by_text("Use an exact model", exact=True).click()
        exact_model = page.get_by_test_id("ai-exact-model")
        if exact_model.locator("option").count() < 2:
            raise AssertionError("Exact model picker did not expose the live catalogue.")
        exact_model.select_option(index=1)
        if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") is not True:
            raise AssertionError("AI setup overflows the viewport after theme selection.")
        page.set_viewport_size({"width": 375, "height": 900})
        if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") is not True:
            raise AssertionError("AI setup overflows the mobile viewport.")
        page.get_by_role("button", name="Start AI debate", exact=True).click()
        page.get_by_text("AI DEBATE", exact=True).wait_for()

        ai_draft = "This AI draft should remain on the device until I submit it."
        page.get_by_label("Your AI debate argument").fill(ai_draft)
        page.reload(wait_until="networkidle")
        page.get_by_text("AI DEBATE", exact=True).wait_for()
        if page.get_by_label("Your AI debate argument").input_value() != ai_draft:
            raise AssertionError("An unsent AI argument was not restored after refresh")

        for argument in ARGUMENTS:
            send_argument(page, argument)
            if argument != ARGUMENTS[-1]:
                page.get_by_role("button", name="Send argument", exact=True).wait_for(timeout=10_000)

        page.get_by_text("Debate complete.").wait_for(timeout=10_000)
        page.get_by_role("button", name="Complete and review", exact=True).click()
        page.get_by_text("Debate complete.", exact=True).wait_for(timeout=30_000)
        page.get_by_text("ARGUMENT REVIEW").wait_for()
        page.locator(".ai-results-page > .muted").filter(has_text="maximum quality · detailed replies").wait_for()

        page.get_by_role("button", name="Rematch same opponent", exact=True).click()
        page.get_by_text("AI DEBATE SETUP").wait_for(timeout=10_000)

        if errors:
            raise AssertionError(f"Browser console errors: {errors}")
        print("AI_MOCK_FLOW_OK")
        browser.close()


if __name__ == "__main__":
    main()
