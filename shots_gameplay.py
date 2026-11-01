# -*- coding: utf-8 -*-
"""Скриншоты геймплея: бой с мобом, панель крафта/кузницы, диалог NPC, лист персонажа."""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = "http://localhost:3000/?server=ws://localhost:3000/ws"
OUT = "/workspace/screenshots/gameplay"; os.makedirs(OUT, exist_ok=True)

async def grab(page, name):
    data = await page.evaluate("()=>{const c=document.getElementById('gl');return c?c.toDataURL('image/png'):null;}")
    if data:
        raw = base64.b64decode(data.split(',',1)[1])
        open(f"{OUT}/{name}.png","wb").write(raw)
        print("shot:", name, len(raw)//1024, "KB")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(BASE, wait_until="networkidle"); await page.wait_for_timeout(1000)
        # флоу создания (тот же, что в shots_locations)
        await page.click("#tab-register")
        await page.fill("#reg-email","gp-test@efiria.ru"); await page.fill("#reg-nick","ГеймплейТест")
        await page.fill("#reg-pass","nightfall"); await page.fill("#reg-pass2","nightfall")
        await page.click("#btn-register")
        await page.wait_for_selector("#screen-world:not(.hidden)", timeout=8000)
        cards = await page.query_selector_all("#world-list > *")
        if cards: await cards[0].click(); await page.wait_for_timeout(200)
        await page.click("#btn-world-next")
        await page.wait_for_selector("#screen-faction:not(.hidden)", timeout=8000)
        fc = await page.query_selector_all("#faction-cards > *")
        if fc: await fc[0].click(); await page.wait_for_timeout(200)
        await page.click("#btn-faction-next")
        await page.wait_for_selector("#screen-create:not(.hidden)", timeout=8000)
        a = await page.query_selector_all(".arch-item")
        if a: await a[0].click(); await page.wait_for_timeout(200)
        r = await page.query_selector_all(".class-card:not(.locked)")
        if r: await r[0].click(); await page.wait_for_timeout(200)
        await page.fill("#hero-name","ГП-Тест")
        await page.click("#btn-start", force=True)
        await page.wait_for_selector("#screen-game:not(.hidden)", timeout=30000)
        await page.wait_for_timeout(4000)

        # 1. базовый вид мира с героем и HUD
        await grab(page, "01_вид_мира_HUD")

        # 2. бой: подойти к ближайшему мобу и атаковать
        fight = await page.evaluate("""()=>{
            const g=window.__nvrGame; if(!g||!g.mobs.length) return null;
            const m=g.mobs.find(m=>m.alive)||g.mobs[0];
            g.char.pos.set(m.pos.x+2.2, g.char.pos.y, m.pos.z+2.2);
            g.target=m; return {name:m.def.name};
        }""")
        if fight:
            for _ in range(6):
                await page.mouse.click(640, 360); await page.wait_for_timeout(500)
            await page.keyboard.press("Space"); await page.wait_for_timeout(400)
            await page.wait_for_timeout(900)
            await grab(page, "02_бой_с_мобом")
        else:
            print("no mobs to fight")

        # 3. лист персонажа (K)
        await page.keyboard.press("k"); await page.wait_for_timeout(600)
        await grab(page, "03_лист_персонажа")
        await page.keyboard.press("k"); await page.wait_for_timeout(300)

        # 4. крафт/кузница (B)
        await page.keyboard.press("b"); await page.wait_for_timeout(600)
        await grab(page, "04_кузница_крафт")
        await page.keyboard.press("b"); await page.wait_for_timeout(300)

        # 5. квесты (J)
        await page.keyboard.press("j"); await page.wait_for_timeout(600)
        await grab(page, "05_журнал_квестов")
        await page.keyboard.press("j"); await page.wait_for_timeout(300)

        # 6. диалог с NPC — у NPC есть parts.root (THREE.Group), открываем его диалог
        dlg = await page.evaluate("""()=>{
            const g=window.__nvrGame; if(!g||!g.npcs.length) return null;
            const n=g.npcs[0];
            const rp=n.parts.root.position;
            g.char.pos.set(rp.x+1.5, g.char.pos.y, rp.z+1.5);
            g.openNpcDialog(n.def);
            return n.def.name;
        }""")
        await page.wait_for_timeout(800)
        if dlg is not None:
            await grab(page, "06_диалог_npc")

        await b.close()
        print("errors:", errs[:5] or "(none)")

asyncio.run(main())
