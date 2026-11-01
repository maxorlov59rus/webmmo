import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080/"
OUT = "/workspace/screenshots"
os.makedirs(OUT, exist_ok=True)
errors = []

async def shot(page, name):
    await page.screenshot(path=f"{OUT}/{name}.png")
    print("shot:", name)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await shot(page, "01_auth_login")

        # регистрация
        await page.click("#tab-register")
        await page.fill("#reg-email", "vyuh@efiria.ru")
        await page.fill("#reg-nick", "Вьюг")
        await page.fill("#reg-pass", "nightfall")
        await page.fill("#reg-pass2", "nightfall")
        await shot(page, "02_register")
        await page.click("#btn-register")
        await page.wait_for_timeout(800)

        # выбор мира
        try:
            await page.wait_for_selector("#screen-world:not(.hidden)", timeout=5000)
        except Exception as e:
            print("world screen not shown:", e)
        await shot(page, "03_worlds")
        worlds = await page.query_selector_all("#world-list .world-card, #world-list > *")
        if worlds:
            await worlds[0].click()
            await page.wait_for_timeout(300)
            await shot(page, "04_world_selected")
            await page.click("#btn-world-next")
            await page.wait_for_timeout(600)

        # фракции
        try:
            await page.wait_for_selector("#screen-faction:not(.hidden)", timeout=5000)
        except Exception as e:
            print("faction screen not shown:", e)
        await shot(page, "05_factions")
        fcards = await page.query_selector_all("#faction-cards > *")
        if fcards:
            await fcards[0].click()
            await page.wait_for_timeout(300)
            await shot(page, "06_faction_selected")
            await page.click("#btn-faction-next")
            await page.wait_for_timeout(600)

        # создание персонажа
        try:
            await page.wait_for_selector("#screen-create:not(.hidden)", timeout=5000)
        except Exception as e:
            print("create screen not shown:", e)
        archs = await page.query_selector_all("#arch-list > *")
        if archs:
            await archs[0].click()
        roles = await page.query_selector_all("#role-cards > *")
        if roles:
            await roles[0].click()
        await page.fill("#hero-name", "Вьюг Ночной")
        rnd = page.locator("#btn-tpl-random")
        for i in range(3):
            await rnd.click()
            await page.wait_for_timeout(200)
        await page.wait_for_timeout(500)
        await shot(page, "07_character_creation")

        # старт игры
        btn = page.locator("#btn-start")
        if await btn.is_enabled():
            await btn.click()
        else:
            print("start button disabled; trying anyway"); await btn.click(force=True)
        # ждём загрузку -> игру
        try:
            await page.wait_for_selector("#screen-game:not(.hidden)", timeout=15000)
        except Exception as e:
            print("game screen not shown:", e)
        await page.wait_for_timeout(2500)
        await shot(page, "08_game_world")

        # немного поиграем: движение вперёд
        await page.keyboard.down("w"); await page.mouse.move(640, 360)
        await page.wait_for_timeout(2500); await page.keyboard.up("w")
        await page.wait_for_timeout(500)
        await shot(page, "09_game_moving")

        # панель персонажа (C)
        await page.keyboard.press("c"); await page.wait_for_timeout(500)
        await shot(page, "10_char_panel")
        await page.keyboard.press("c")
        # инвентарь (I)
        await page.keyboard.press("i"); await page.wait_for_timeout(500)
        await shot(page, "11_inventory")
        await page.keyboard.press("i")
        # журнал квестов (J)
        await page.keyboard.press("j"); await page.wait_for_timeout(500)
        await shot(page, "12_quests")
        await page.keyboard.press("j")
        # чат
        await page.keyboard.press("Enter")
        await page.type("#chat-input", "Хто тут? Застава не спит?")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1500)
        await shot(page, "13_chat")

        await browser.close()
    print("=== console/page errors ===")
    for e in errors[:20]:
        print("ERR:", e)
    if not errors:
        print("(none)")

asyncio.run(main())
