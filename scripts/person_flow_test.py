import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        puter_requests = []
        page.on("request", lambda request: puter_requests.append(request.url) if "@heyputer" in request.url.lower() or "puter.js" in request.url.lower() else None)
        page.goto(BASE, wait_until="networkidle")
        if page.locator(".onboarding-page").count():
            page.get_by_role("button", name="Continue", exact=True).click()
            page.locator("#onboarding-name").fill("Real User")
            page.get_by_role("button", name="Continue", exact=True).click()
            page.get_by_role("button", name="Continue", exact=True).click()
            page.get_by_role("button", name="Skip for now", exact=True).click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Real\."), exact=False).wait_for(timeout=10_000)
        if page.get_by_role("dialog").count():
            page.get_by_role("dialog").get_by_text("Got it", exact=True).click()
        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.locator(".debate-choice-person").click()
        page.locator(".clash-page").wait_for(timeout=10_000)
        if page.locator(".ai-connection-card").count() != 0:
            raise AssertionError("Person flow rendered an AI connection card.")
        if page.get_by_text("Connect AI opponents", exact=True).count() != 0:
            raise AssertionError("Person flow exposed the Puter connection prompt.")
        if puter_requests:
            raise AssertionError(f"Person flow requested Puter resources: {puter_requests}")
        print("REAL_PERSON_FLOW_OK")
        browser.close()


if __name__ == "__main__":
    main()
