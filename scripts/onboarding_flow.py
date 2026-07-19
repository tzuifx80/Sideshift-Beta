from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        page.goto(BASE, wait_until="networkidle")
        page.locator(".onboarding-page").wait_for()
        for locale in ("de", "fr", "es", "it", "en", "de"):
            page.locator("#onboarding-language").select_option(locale)
            if page.locator("#onboarding-language").input_value() != locale:
                raise AssertionError(f"Language selection did not persist for {locale}")
        page.get_by_role("button", name="Fortsetzen", exact=True).click()
        page.reload(wait_until="networkidle")
        page.locator("#onboarding-name").wait_for()
        page.locator("#onboarding-name").fill("Onboarding Test")
        page.get_by_role("button", name="Fortsetzen", exact=True).click()
        page.reload(wait_until="networkidle")
        page.get_by_text("Wähle deinen ersten Schritt", exact=True).wait_for()
        if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") is not True:
            raise AssertionError("Onboarding overflows the 390px viewport")
        page.locator(".onboarding-card button").first.click()
        page.get_by_text("Starte mit etwas Echtem", exact=True).wait_for()
        page.get_by_role("button", name="Jetzt überspringen", exact=True).click()
        page.get_by_role("button", name="Guide schließen", exact=True).click()
        page.get_by_text("DE", exact=True).first.wait_for()
        page.get_by_role("button", name="Profil", exact=True).last.click()
        page.get_by_role("button", name="Profil bearbeiten", exact=True).click()
        page.get_by_role("button", name="So funktioniert SideShift", exact=True).click()
        page.locator("#onboarding-language").wait_for()
        print("ONBOARDING_FLOW_OK language=de refresh_resume=1 mobile_overflow=0")
        browser.close()


if __name__ == "__main__":
    main()
