# -*- coding: utf-8 -*-
"""
Скриншоты локаций «Ночи Военного Ремесла» с тестовым персонажем.
Проходит полный флоу (регистрация -> мир -> фракция -> создание), затем
телепортирует тестового героя по всем 8 локациям и снимает каждую.
Требует: python3 -m http.server 8080 (в корне проекта) + playwright chromium.
"""
import asyncio, os, re, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000/?server=ws://localhost:3000/ws"
OUT = "/workspace/screenshots/locations"
os.makedirs(OUT, exist_ok=True)
errors = []

LOC_KEYS = ["outpost", "hollow", "barrow", "pinewood", "minecamp", "aeriadocks", "grove", "ashfields"]
LOC_NAMES = {
    "outpost": "01_Ночная_Застава", "hollow": "02_Выгоршая_Пустошь", "barrow": "03_Курганы_Первых_Дозоров",
    "pinewood": "04_Сумеречный_Бор", "minecamp": "05_Разрытая_Шахта", "aeriadocks": "06_Причалы_Аэрии",
    "grove": "07_Роща_Шепчущих_Кострей", "ashfields": "08_Пепельное_Поле",
}

async def shot(page, name):
    path = f"{OUT}/{name}.png"
    # в swiftshader кадры долгие — снимаем canvas напрямую с таймаутом и запасным вариантом
    try:
        el = await page.query_selector("#gl")
        if el:
            await el.screenshot(path=path, timeout=15000)
        else:
            raise RuntimeError("no canvas")
    except Exception as e:
        print("canvas shot failed, fallback fullpage:", str(e)[:80])
        await page.screenshot(path=path, timeout=25000, animations="disabled")
    print("shot:", path)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---------- флоу создания тестового персонажа ----------
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(1200)

        await page.click("#tab-register")
        await page.fill("#reg-email", "testhero@efiria.ru")
        await page.fill("#reg-nick", "ТестовыйГерой")
        await page.fill("#reg-pass", "nightfall")
        await page.fill("#reg-pass2", "nightfall")
        await page.click("#btn-register")
        try:
            await page.wait_for_selector("#screen-world:not(.hidden)", timeout=8000)
        except Exception as e:
            print("world screen not shown:", e); return

        cards = await page.query_selector_all("#world-list > *")
        if cards: await cards[0].click(); await page.wait_for_timeout(250)
        await page.click("#btn-world-next")
        await page.wait_for_selector("#screen-faction:not(.hidden)", timeout=8000)

        fcards = await page.query_selector_all("#faction-cards > *")
        if fcards: await fcards[0].click(); await page.wait_for_timeout(250)
        await page.click("#btn-faction-next")
        await page.wait_for_selector("#screen-create:not(.hidden)", timeout=8000)

        # tpl-select — это <select>, кликать по нему не нужно (он скрыт за нативным дропдауном)
        archs = await page.query_selector_all(".arch-item")
        if archs: await archs[0].click(); await page.wait_for_timeout(300)
        roles = await page.query_selector_all(".class-card:not(.locked)")
        if roles: await roles[0].click(); await page.wait_for_timeout(300)
        await page.fill("#hero-name", "Тест-Герой")
        await page.wait_for_timeout(200)
        btn = page.locator("#btn-start")
        print("btn-start enabled:", await btn.is_enabled())
        await btn.click(force=True)

        # если boot упал — loading-text покажет причину
        try:
            await page.wait_for_selector("#screen-game:not(.hidden)", timeout=25000)
        except Exception as e:
            txt = await page.evaluate("()=>document.getElementById('loading-text')?.textContent")
            print("game screen not shown. loading-text:", txt, "| err:", str(e)[:120])
            for er in errors[:10]: print("ERR:", er)
            await shot(page, "_fail_debug")
            return
        # даём миру построиться
        await page.wait_for_timeout(3500)

        ok = await page.evaluate("()=>!!(window.__nvrGame && window.__nvrGame.scene)")
        print("game booted:", ok)
        if not ok:
            print("no game instance; abort"); return

        # список локаций берём прямо из игровых данных в рантайме
        locs = await page.evaluate("""async ()=>{
            const m = await import('/src/data/consts.js');
            return Object.values(m.LOCATIONS).map(l=>({id:l.id,name:l.name,icon:l.icon,lv:l.levelRange,safe:l.safe}));
        }""")
        print("locations in runtime:", [l["id"] for l in locs])

        # ---------- скриншот каждой локации с тестовым персонажем ----------
        for i, lid in enumerate(LOC_KEYS):
            tele = await page.evaluate(f"()=>window.__nvrGame.teleportToLocation('{lid}')")
            if not tele:
                print("teleport failed for", lid); continue
            # лёгкое движение, чтобы герой «ожил» в новой зоне
            await page.keyboard.down("w"); await page.wait_for_timeout(900); await page.keyboard.up("w")
            await page.wait_for_timeout(1600)  # рендер мобов/npc, тени, камера
            meta = next((l for l in locs if l["id"] == lid), {})
            name = LOC_NAMES.get(lid, f"{i+1:02d}_{lid}")
            await shot(page, name)
            # подпись на самом скриншоте не делаем — имя уже в файле + HUD показывает зону
        await browser.close()

    print("=== console/page errors ===")
    for e in errors[:15]:
        print("ERR:", e)
    if not errors:
        print("(none)")

asyncio.run(main())
