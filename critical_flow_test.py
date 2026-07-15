import re

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4173"
RESPONSES = [
    "Safety matters, but a hard age cut-off should be paired with better platform design and family support.",
    "The concern about hidden spaces is real, but visibility is not a reason to leave young people unprotected.",
    "I would change my mind if reliable evidence showed no improvement in wellbeing after a restriction.",
    "The best case against my side is that autonomy and access to community also matter while growing up.",
    "A clear boundary creates room for safer defaults while still leaving space for thoughtful exceptions.",
]


def fill_and_send(page, text):
    page.locator("textarea").fill(text)
    page.locator(".response-box-bottom .button").wait_for(state="visible", timeout=10_000)
    button = page.get_by_role("button", name="Send response", exact=True)
    if button.count():
        button.click()
    else:
        page.get_by_role("button", name="See my shift", exact=True).click()
    page.wait_for_function("""() => {
        const field = document.querySelector('.response-box textarea')
        return !field || field.value === ''
    }""", timeout=10_000)


def main():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(BASE, wait_until="networkidle")

        page.get_by_label("Display name").fill("Integration Tester")
        page.get_by_role("button", name="Politics and Democracy", exact=True).wait_for()
        page.get_by_role("button", name="Enter the arena").click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Integration"), exact=False).wait_for()
        page.get_by_role("dialog").wait_for()
        page.get_by_role("dialog").get_by_text("Got it", exact=True).click()

        page.locator(".sidebar-nav").get_by_role("button", name="Profile", exact=True).click()
        page.get_by_role("button", name="Edit profile", exact=True).click()
        page.get_by_text("YOUR CONTROL ROOM").wait_for()
        page.get_by_role("button", name="How SideShift works", exact=True).click()
        page.get_by_role("dialog").wait_for()
        page.get_by_role("dialog").get_by_text("Got it", exact=True).click()
        page.locator("#settings-bio").fill("Testing thoughtful disagreement.")
        page.get_by_role("button", name="Civil Rights and Equality", exact=True).click()
        page.get_by_label("Theme").select_option("dark")
        page.get_by_role("button", name="Save", exact=True).last.click()
        page.get_by_text("Settings saved privately.").wait_for()
        page.reload(wait_until="networkidle")
        if page.locator("html").get_attribute("data-theme") != "dark":
            raise AssertionError("Theme preference was not preserved after refresh")
        page.get_by_role("button", name="Profile", exact=True).click()
        page.get_by_text("YOUR PRIVATE PROFILE").wait_for()
        page.get_by_role("button", name="Home", exact=True).first.click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Integration"), exact=False).wait_for()

        page.get_by_role("button", name="Take a side").click()
        page.get_by_text("Where do you actually").wait_for()
        page.get_by_role("button", name="Agree", exact=True).click()
        page.get_by_role("button", name="Lock in my stance").click()

        draft_text = "This unsent draft should survive a refresh before submission."
        page.locator("textarea").fill(draft_text)
        page.reload(wait_until="networkidle")
        page.locator(".argument-heading h1").wait_for()
        if page.locator("textarea").input_value() != draft_text:
            raise AssertionError("An unsent argument draft was not restored after refresh")
        page.once("dialog", lambda dialog: dialog.accept())
        page.locator(".sidebar-nav").get_by_role("button", name="Profile", exact=True).click()
        page.get_by_role("button", name="Edit profile", exact=True).click()
        page.get_by_text("YOUR CONTROL ROOM").wait_for()
        page.locator(".sidebar-nav").get_by_role("button", name="Home", exact=True).click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Integration"), exact=False).wait_for()
        page.get_by_text("Continue your debate", exact=True).click()
        page.locator(".argument-heading h1").wait_for()
        if page.locator("textarea").input_value() != draft_text:
            raise AssertionError("An unsent argument draft was not restored after in-app navigation")

        fill_and_send(page, RESPONSES[0])
        page.locator(".argument-heading h1").wait_for()
        page.reload(wait_until="networkidle")
        page.locator(".argument-heading h1").wait_for()
        if page.locator("textarea").input_value() != "":
            raise AssertionError("A new round unexpectedly inherited the previous response")

        for response in RESPONSES[1:]:
            fill_and_send(page, response)
            if response != RESPONSES[-1]:
                page.wait_for_timeout(200)

        page.get_by_text("Did anything").wait_for()
        page.get_by_role("button", name="Agree", exact=True).last.click()
        page.get_by_role("button", name="Definitely").click()
        page.get_by_role("button", name="Show me the result").click()
        page.get_by_text("That was a").wait_for(timeout=10_000)
        page.get_by_text("The Shift Card").wait_for()
        score = page.locator(".result-score-hero strong").inner_text()
        if not score.isdigit() or not 0 <= int(score) <= 100:
            raise AssertionError(f"Invalid result score: {score}")
        page.get_by_text("Share beta feedback").wait_for()
        page.locator("#beta-feedback-debate_result").fill("The completed debate feedback flow works.")
        page.get_by_role("button", name="Send feedback", exact=True).click()
        page.get_by_text("Thanks. Your feedback was saved privately.").wait_for()

        page.locator(".sidebar-nav .nav-item").filter(has_text="Profile").click()
        page.get_by_text("YOUR DEBATE DNA").wait_for()
        page.locator(".personal-profile .profile-tags").get_by_text(re.compile(r"Current streak", re.IGNORECASE), exact=False).wait_for()
        page.get_by_role("button", name="Home", exact=True).first.click()
        page.get_by_text(re.compile(r"Good (morning|afternoon|evening), Integration"), exact=False).wait_for()

        page.reload(wait_until="networkidle")
        page.get_by_text("The Shift Card").wait_for()

        page.get_by_role("button", name="Challenge a friend").click()
        page.get_by_role("heading", name="Make your case.").wait_for()
        page.locator("#clash-argument").fill("The strongest reason is that better defaults protect people without removing all autonomy.")
        page.get_by_role("button", name="Create challenge").click()
        page.get_by_text("Challenge ready").wait_for(timeout=10_000)
        challenge_url = page.locator(".generated-link > span").inner_text().replace("", "").strip()
        if not challenge_url.startswith(BASE):
            raise AssertionError(f"Challenge URL was not generated by the running server: {challenge_url}")

        recipient_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        recipient = recipient_context.new_page()
        recipient.goto(challenge_url, wait_until="networkidle")
        recipient.get_by_text("Can you answer").wait_for()
        recipient.get_by_text("The strongest reason is that better defaults protect people without removing all autonomy.").wait_for()
        recipient.locator("#challenge-response").fill("A thoughtful counterpoint is that autonomy also requires safe defaults and clear accountability.")
        recipient.get_by_role("button", name="Send my counter").click()
        recipient.get_by_text("Challenge complete").wait_for(timeout=10_000)
        recipient.reload(wait_until="networkidle")
        recipient.get_by_text("This challenge has already been answered.").wait_for()
        page.get_by_text("Counter received").wait_for(timeout=10_000)

        for width in (320, 375, 390, 768, 1440):
            page.set_viewport_size({"width": width, "height": 900})
            page.goto(BASE, wait_until="networkidle")
            if width <= 900:
                page.locator(".mobile-nav").wait_for(state="visible")
            overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            if overflow:
                raise AssertionError(f"Horizontal overflow at {width}px")

        if errors:
            raise AssertionError(f"Browser console errors: {errors}")
        print("CRITICAL_FLOW_OK")
        browser.close()


if __name__ == "__main__":
    main()
