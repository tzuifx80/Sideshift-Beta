from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

from playwright.sync_api import Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
FRONTEND_HOST = "127.0.0.1"
FRONTEND_PORT = int(os.getenv("SIDESHIFT_FRONTEND_PORT", "5173"))
API_PORT = 8787
BASE = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}"
API_BASE = f"http://{FRONTEND_HOST}:{API_PORT}"
STARTUP_TIMEOUT_SECONDS = 30
PAGE_TIMEOUT_MS = 15_000

RESPONSES = [
    "Safety matters, but a hard age cut-off should be paired with better platform design and family support.",
    "The concern about hidden spaces is real, but visibility is not a reason to leave young people unprotected.",
    "I would change my mind if reliable evidence showed no improvement in wellbeing after a restriction.",
    "The best case against my side is that autonomy and access to community also matter while growing up.",
    "A clear boundary creates room for safer defaults while still leaving space for thoughtful exceptions.",
]

ENV_LINE = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def parse_env_value(raw: str) -> str:
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    if " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    return value


def load_root_env() -> dict[str, str]:
    if not ENV_FILE.is_file():
        return {}
    values: dict[str, str] = {}
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = ENV_LINE.match(line)
        if match:
            values[match.group(1)] = parse_env_value(match.group(2))
    for key, value in values.items():
        os.environ.setdefault(key, value)
    return values


def require_environment(env_values: dict[str, str]) -> dict[str, str]:
    missing = [] if ENV_FILE.is_file() else [".env"]
    required_browser = ["VITE_DATA_BACKEND", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]
    required_server = ["DATA_BACKEND", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    missing.extend(name for name in required_browser + required_server if not os.getenv(name))
    if missing:
        unique_missing = list(dict.fromkeys(missing))
        print(f"SUPABASE_PLAYWRIGHT_BLOCKED: missing {', '.join(unique_missing)}")
        return {}

    mismatches = []
    if os.getenv("VITE_DATA_BACKEND", "").lower() != "supabase":
        mismatches.append("VITE_DATA_BACKEND=supabase")
    if os.getenv("DATA_BACKEND", "").lower() != "supabase":
        mismatches.append("DATA_BACKEND=supabase")
    if mismatches:
        print(f"SUPABASE_PLAYWRIGHT_BLOCKED: required configuration {' and '.join(mismatches)}")
        return {}

    child_env = os.environ.copy()
    for key, value in env_values.items():
        child_env.setdefault(key, value)
    return child_env


def safe_url(value: str) -> str:
    parsed = urlsplit(value)
    path = re.sub(r"(/challenge/)[A-Za-z0-9_-]+", r"\1<redacted>", parsed.path)
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def http_json(url: str) -> tuple[int, dict]:
    request = Request(url, headers={"accept": "application/json"})
    with urlopen(request, timeout=1.5) as response:
        payload = response.read().decode("utf-8")
        return response.status, json.loads(payload or "{}")


def wait_for_api(process: subprocess.Popen[str]) -> dict:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    last_error = "not reached"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"API process exited with code {process.returncode} before health check")
        try:
            status, payload = http_json(f"{API_BASE}/api/health")
            if status == 200 and payload.get("ok") and payload.get("persistence") == "supabase":
                return payload
            if status == 200 and payload.get("ok") and payload.get("persistence"):
                raise RuntimeError(f"API backend mismatch: expected supabase, got {payload.get('persistence')}")
            last_error = f"status={status}, payload_keys={sorted(payload.keys())}"
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            last_error = type(error).__name__
        time.sleep(0.25)
    raise TimeoutError(f"API health check timed out: {last_error}")


def wait_for_frontend(process: subprocess.Popen[str]) -> None:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    last_error = "not reached"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Vite process exited with code {process.returncode} before readiness check")
        try:
            request = Request(f"{BASE}/", headers={"accept": "text/html"})
            with urlopen(request, timeout=1.5) as response:
                if response.status == 200:
                    return
                last_error = f"status={response.status}"
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = type(error).__name__
        time.sleep(0.25)
    raise TimeoutError(f"Vite readiness check timed out: {last_error}")


def start_process(command: list[str], env: dict[str, str], log_path: Path) -> tuple[subprocess.Popen[str], object]:
    log_handle = log_path.open("w", encoding="utf-8")
    creation_flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=creation_flags,
    )
    return process, log_handle


def stop_process(process: subprocess.Popen[str] | None, log_handle: object | None) -> None:
    if process is not None and process.poll() is None:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    if log_handle is not None:
        log_handle.close()


def start_servers(env: dict[str, str], diagnostics_dir: Path) -> tuple[list[tuple[subprocess.Popen[str], object]], dict]:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    processes: list[tuple[subprocess.Popen[str], object]] = []
    try:
        api_process, api_log = start_process([npm, "run", "api"], env, diagnostics_dir / "api.log")
        processes.append((api_process, api_log))
        health = wait_for_api(api_process)
        vite_process, vite_log = start_process(
            [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--port", str(FRONTEND_PORT)],
            env,
            diagnostics_dir / "vite.log",
        )
        processes.append((vite_process, vite_log))
        wait_for_frontend(vite_process)
        return processes, health
    except Exception:
        for process, log_handle in reversed(processes):
            stop_process(process, log_handle)
        raise


class BrowserDiagnostics:
    def __init__(self) -> None:
        self.console_errors: list[str] = []
        self.page_errors: list[str] = []
        self.failed_requests: list[str] = []
        self.http_errors: list[str] = []


def attach_diagnostics(page: Page, diagnostics: BrowserDiagnostics) -> None:
    page.on("console", lambda message: diagnostics.console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: diagnostics.page_errors.append(str(error)))
    page.on("requestfailed", lambda request: diagnostics.failed_requests.append(f"{safe_url(request.url)}: {request.failure}"))
    page.on("response", lambda response: diagnostics.http_errors.append(f"{response.status} {safe_url(response.url)}") if response.status >= 400 else None)


def wait_for_app_ready(page: Page, label: str) -> None:
    try:
        page.wait_for_function(
            """() => {
              const body = document.body?.innerText || '';
              return Boolean(document.querySelector('#display-name'))
                || body.includes('Private session unavailable')
                || body.includes('Private data unavailable')
                || body.includes('Backend unavailable');
            }""",
            timeout=PAGE_TIMEOUT_MS,
        )
    except PlaywrightTimeoutError as error:
        body = page.locator("body").inner_text(timeout=2_000)
        raise RuntimeError(f"{label} did not reach onboarding or an explicit error state: {body[:1000]}") from error

    body = page.locator("body").inner_text(timeout=2_000)
    lower = body.lower()
    if "anonymous" in lower and ("disabled" in lower or "not enabled" in lower or "enable" in lower):
        raise RuntimeError("SUPABASE_AUTH_CONFIGURATION_ERROR: Enable anonymous sign-ins in Supabase Authentication settings.")
    if "private data unavailable" in lower or "backend unavailable" in lower or "private session unavailable" in lower:
        raise RuntimeError(f"{label} reached an application error state: {body[:1000]}")

    display_name = page.get_by_label("Display name")
    display_name.wait_for(state="visible", timeout=2_000)


def open_app(page: Page, label: str) -> None:
    page.goto(BASE, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
    try:
        page.wait_for_load_state("networkidle", timeout=10_000)
    except PlaywrightTimeoutError:
        pass
    wait_for_app_ready(page, label)


def debate_request_has_step(request, marker: str, step: int) -> bool:
    if "/rest/v1/debates" not in request.url or request.method != "POST":
        return False
    post_data = request.post_data or ""
    if marker not in post_data:
        return False
    try:
        payload = json.loads(post_data)
        row = payload[0] if isinstance(payload, list) else payload
        return isinstance(row, dict) and isinstance(row.get("snapshot"), dict) and row["snapshot"].get("step") == step
    except (TypeError, ValueError, KeyError):
        return f'"step":{step}' in post_data or f'"step": {step}' in post_data


def send(page: Page, text: str, step: int) -> None:
    page.locator("textarea").fill(text)
    button_name = "See my shift" if step == 5 else "Send response"
    button = page.get_by_role("button", name=button_name, exact=True)
    marker = text[:24]
    with page.expect_response(
        lambda response: debate_request_has_step(response.request, marker, step + 1) and response.status < 400,
        timeout=PAGE_TIMEOUT_MS,
    ) as response_info:
        with page.expect_request(
            lambda request: debate_request_has_step(request, marker, step),
            timeout=PAGE_TIMEOUT_MS,
        ):
            button.click()
    response = response_info.value
    if response.status >= 400:
        raise RuntimeError(f"Supabase debate persistence returned HTTP {response.status}.")


def save_page_diagnostics(page: Page, name: str, diagnostics_dir: Path) -> None:
    try:
        page.screenshot(path=str(diagnostics_dir / f"{name}.png"), full_page=True)
    except Exception:
        pass
    try:
        (diagnostics_dir / f"{name}.html").write_text(page.content(), encoding="utf-8")
    except Exception:
        pass


def run_flow(env: dict[str, str], diagnostics_dir: Path) -> None:
    npm_processes: list[tuple[subprocess.Popen[str], object]] = []
    browser: Browser | None = None
    contexts: list[BrowserContext] = []
    pages: list[tuple[Page, BrowserDiagnostics]] = []
    traces_started: list[tuple[BrowserContext, str]] = []
    failure: Exception | None = None

    try:
        npm_processes, health = start_servers(env, diagnostics_dir)
        print(f"SUPABASE_PLAYWRIGHT_SERVER_OK active_backend={health.get('persistence')} ai_mode={health.get('aiMode')}")

        playwright = sync_playwright().start()
        try:
            browser = playwright.chromium.launch(headless=True)
            context_a = browser.new_context(viewport={"width": 1440, "height": 1000})
            contexts.append(context_a)
            context_a.tracing.start(screenshots=True, snapshots=True, sources=True)
            traces_started.append((context_a, "context-a.zip"))
            page_a = context_a.new_page()
            diagnostics_a = BrowserDiagnostics()
            attach_diagnostics(page_a, diagnostics_a)
            pages.append((page_a, diagnostics_a))

            open_app(page_a, "Context A")
            page_a.get_by_label("Display name").fill("Supabase A")
            page_a.get_by_role("button", name="Enter the arena").click()
            page_a.get_by_text("Good morning, Supabase").wait_for(timeout=PAGE_TIMEOUT_MS)
            if page_a.get_by_role("dialog").count():
                page_a.get_by_role("dialog").get_by_text("Got it", exact=True).click()
            page_a.get_by_role("button", name="Take a side").click()
            page_a.get_by_role("button", name="Agree", exact=True).click()
            page_a.get_by_role("button", name="Lock in my stance").click()
            send(page_a, RESPONSES[0], 1)
            page_a.locator(".argument-heading h1").wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.reload(wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
            page_a.locator(".argument-heading h1").wait_for(timeout=PAGE_TIMEOUT_MS)
            for step, response in enumerate(RESPONSES[1:], start=2):
                send(page_a, response, step)
            page_a.get_by_role("button", name="Agree", exact=True).last.click()
            page_a.get_by_role("button", name="Definitely").click()
            page_a.get_by_role("button", name="Show me the result").click()
            page_a.get_by_text("The Shift Card").wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.get_by_role("button", name="Challenge a friend").click()
            page_a.locator("#clash-argument").fill("The strongest reason is that better defaults protect people without removing all autonomy.")
            page_a.get_by_role("button", name="Create challenge").click()
            page_a.get_by_text("Challenge ready").wait_for(timeout=PAGE_TIMEOUT_MS)
            challenge_url = page_a.locator(".generated-link > span").inner_text().strip()
            if not challenge_url.startswith(f"{BASE}/challenge/"):
                raise AssertionError("Challenge URL did not target the managed frontend server.")

            context_b = browser.new_context(viewport={"width": 1440, "height": 1000})
            contexts.append(context_b)
            context_b.tracing.start(screenshots=True, snapshots=True, sources=True)
            traces_started.append((context_b, "context-b.zip"))
            page_b = context_b.new_page()
            diagnostics_b = BrowserDiagnostics()
            attach_diagnostics(page_b, diagnostics_b)
            pages.append((page_b, diagnostics_b))
            page_b.goto(challenge_url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
            try:
                page_b.wait_for_load_state("networkidle", timeout=10_000)
            except PlaywrightTimeoutError:
                pass
            page_b.get_by_text("Can you answer").wait_for(timeout=PAGE_TIMEOUT_MS)
            page_b.locator("#challenge-response").fill("A thoughtful counterpoint is that autonomy also requires safe defaults and clear accountability.")
            page_b.get_by_role("button", name="Send my counter").click()
            page_b.get_by_text("Challenge complete").wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.get_by_text("Counter received").wait_for(timeout=PAGE_TIMEOUT_MS)
            page_a.reload(wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
            with page_a.expect_response(
                lambda response: "/rest/v1/rpc/list_my_challenges" in response.url and response.status < 400,
                timeout=PAGE_TIMEOUT_MS,
            ) as list_response_info:
                page_a.get_by_role("button", name="Challenge a friend").click()
            listed_challenges = list_response_info.value.json()
            if not any(item.get("status") == "completed" and item.get("response") for item in listed_challenges if isinstance(item, dict)):
                raise AssertionError("Refresh did not return the completed challenge from list_my_challenges.")
            page_a.get_by_text("Counter received").wait_for(timeout=PAGE_TIMEOUT_MS)
        except Exception as error:
            failure = error
            raise
        finally:
            if failure is not None:
                for page, _diagnostics in pages:
                    save_page_diagnostics(page, f"page-{len(list(diagnostics_dir.glob('page-*.png'))) + 1}", diagnostics_dir)
            for context, trace_name in traces_started:
                try:
                    context.tracing.stop(path=str(diagnostics_dir / trace_name) if failure is not None else None)
                except Exception:
                    pass
            if browser is not None:
                browser.close()
            playwright.stop()
    except Exception as error:
        failure = error
    finally:
        for process, log_handle in reversed(npm_processes):
            stop_process(process, log_handle)

    if failure is not None:
        diagnostics_payload = {
            "console_errors": [item for _, diagnostics in pages for item in diagnostics.console_errors],
            "page_errors": [item for _, diagnostics in pages for item in diagnostics.page_errors],
            "failed_requests": [item for _, diagnostics in pages for item in diagnostics.failed_requests],
            "http_errors": [item for _, diagnostics in pages for item in diagnostics.http_errors],
        }
        (diagnostics_dir / "browser-diagnostics.json").write_text(json.dumps(diagnostics_payload, indent=2), encoding="utf-8")
        print(f"SUPABASE_PLAYWRIGHT_FAILED: {failure}")
        print(f"SUPABASE_PLAYWRIGHT_DIAGNOSTICS: {diagnostics_dir}")
        raise SystemExit(1)

    shutil.rmtree(diagnostics_dir, ignore_errors=True)
    print("SUPABASE_PLAYWRIGHT_OK contexts=2 challenge=completed refresh=recovered active_backend=supabase")


def main() -> int:
    env_values = load_root_env()
    child_env = require_environment(env_values)
    if not child_env:
        return 2
    diagnostics_dir = Path(tempfile.mkdtemp(prefix="sideshift-supabase-playwright-"))
    run_flow(child_env, diagnostics_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
