from pathlib import Path

import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"
OUTPUT = Path(r"C:\Users\Admin\.codex\visualizations\2026\07\12\019f55fe-bedb-7c90-a504-be2899a113b1")


def save_settings(page):
    save_button = page.get_by_role("button", name="Save", exact=True).last
    save_button.click()
    page.wait_for_function("""() => [...document.querySelectorAll('.settings-page button')].some(button => button.textContent?.trim() === 'Save' && !button.disabled)""")
    page.get_by_text("Settings saved privately.", exact=True).wait_for()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.goto(BASE, wait_until="networkidle")
        if page.get_by_label("Display name").count():
            page.get_by_label("Display name").fill("Visual Tester")
            page.get_by_role("button", name="Enter the arena").click()
        page.locator('.home-heading h1').wait_for(timeout=10_000)
        if page.get_by_role("button", name="Got it", exact=True).count():
            page.get_by_role("button", name="Got it", exact=True).click()

        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.get_by_text("CHOOSE YOUR DEBATE MODE", exact=True).wait_for()
        page.screenshot(path=str(OUTPUT / "sideshift-choice-light.png"), full_page=True)
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP").wait_for()
        page.screenshot(path=str(OUTPUT / "sideshift-ai-setup-light.png"), full_page=True)

        page.locator(".ai-setup-page .back-link").click()
        page.get_by_role("button", name="Profile", exact=True).first.click()
        page.get_by_role("button", name="Edit profile", exact=True).click()
        for accent in ("coral", "violet", "cyan", "amber", "mint", "neutral"):
            page.locator(f".accent-option.accent-{accent}").click()
            save_settings(page)
            page.wait_for_timeout(500)
            page.locator(f"html[data-accent='{accent}']").wait_for()
            if not page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"):
                raise AssertionError(f"Semantic accent token is missing for {accent}.")
        page.get_by_label("Theme").select_option("dark")
        page.wait_for_timeout(250)
        page.locator(".accent-option.accent-cyan").click()
        page.wait_for_timeout(250)
        save_settings(page)
        page.locator(".settings-page .settings-footer .back-link").click()
        page.locator(".sidebar-nav").get_by_role("button", name="Home", exact=True).click()
        page.locator('.home-heading h1').wait_for()
        if page.locator("html[data-theme='dark']").count() != 1:
            raise AssertionError("Dark theme was not applied.")
        if page.locator("html[data-accent='cyan']").count() != 1:
            raise AssertionError("Cyan accent was not applied.")

        page.get_by_role("button", name="Start a debate", exact=True).first.click()
        page.locator(".debate-choice-ai").click()
        page.get_by_text("AI DEBATE SETUP").wait_for()
        if not page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--background').trim()"):
            raise AssertionError("Semantic background token is missing.")
        if not page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"):
            raise AssertionError("Semantic accent token is missing.")
        page.screenshot(path=str(OUTPUT / "sideshift-ai-setup-dark-cyan.png"), full_page=True)

        for width in (320, 375, 390, 768, 1280):
            page.set_viewport_size({"width": width, "height": 900})
            if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") is not True:
                raise AssertionError(f"AI setup overflows the {width}px viewport.")
        page.locator(".language-button").click()
        page.wait_for_timeout(250)
        if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") is not True:
            raise AssertionError("German AI setup overflows the viewport.")
        page.screenshot(path=str(OUTPUT / "sideshift-ai-setup-mobile-german.png"), full_page=True)
        print("VISUAL_AI_AUDIT_OK")
        browser.close()


if __name__ == "__main__":
    main()
