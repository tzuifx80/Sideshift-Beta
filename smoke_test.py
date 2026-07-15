from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")

        if page.get_by_role("button", name="Enter the arena").count():
            page.get_by_label("Display name").fill("Alex Morgan")
            page.get_by_role("button", name="Enter the arena").click()

        page.get_by_text("Good morning, Alex").wait_for()
        page.screenshot(path=str(Path("artifacts-home.png")), full_page=True)

        page.get_by_role("button", name="Take a side").click()
        page.get_by_text("Where do you actually").wait_for()
        page.get_by_role("button", name="Lock in my stance").click()

        responses = [
            "Safety matters, but a hard age cut-off should be paired with better platform design and family support.",
            "The concern about hidden spaces is real, but visibility is not a reason to leave young people unprotected.",
            "I would change my mind if reliable evidence showed no improvement in wellbeing after a restriction.",
            "The best case against my side is that autonomy and access to community also matter while growing up.",
            "A clear boundary creates room for safer defaults while still leaving space for thoughtful exceptions.",
        ]
        for response in responses:
            page.locator("textarea").fill(response)
            button_name = "See my shift" if response == responses[-1] else "Send response"
            page.get_by_role("button", name=button_name).click()

        page.get_by_role("button", name="Show me the result").click()
        page.get_by_text("That was a").wait_for()
        page.get_by_text("The Shift Card").wait_for()
        page.get_by_role("button", name="Challenge a friend").click()
        page.get_by_role("heading", name="Make your case.").wait_for()
        page.locator("#clash-argument").fill("The strongest reason is that better defaults protect people without removing all autonomy.")
        page.get_by_role("button", name="Create challenge").click()
        page.get_by_text("Challenge ready").wait_for()

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")
        page.locator(".mobile-nav").wait_for(state="visible")
        page.screenshot(path=str(Path("artifacts-mobile.png")), full_page=True)

        print("SMOKE_OK")
        browser.close()


if __name__ == "__main__":
    main()
