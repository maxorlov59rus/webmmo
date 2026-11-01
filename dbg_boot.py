import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        logs=[]
        pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"[:200]))
        pg.on("pageerror", lambda e: logs.append("PAGEERROR: "+str(e)[:300]))
        await pg.goto("http://localhost:3000/?server=ws://localhost:3000/ws", wait_until="networkidle")
        await pg.wait_for_timeout(1500)
        await pg.click("#tab-register")
        await pg.fill("#reg-email","dbg@efiria.ru"); await pg.fill("#reg-nick","Дебаг")
        await pg.fill("#reg-pass","nightfall"); await pg.fill("#reg-pass2","nightfall")
        await pg.click("#btn-register"); await pg.wait_for_timeout(1000)
        print("screen-world visible:", await pg.evaluate("!document.getElementById('screen-world').classList.contains('hidden')"))
        cards = await pg.query_selector_all(".world-card")
        if cards: await cards[0].click(); await pg.wait_for_timeout(300)
        await pg.click("#btn-world-next"); await pg.wait_for_timeout(600)
        fcards = await pg.query_selector_all(".faction-card")
        if fcards: await fcards[0].click(); await pg.wait_for_timeout(300)
        await pg.click("#btn-faction-next"); await pg.wait_for_timeout(600)
        archs = await pg.query_selector_all(".arch-item")
        if archs: await archs[0].click(); await pg.wait_for_timeout(300)
        roles = await pg.query_selector_all(".class-card:not(.locked)")
        if roles: await roles[0].click(); await pg.wait_for_timeout(300)
        await pg.fill("#hero-name","Дебаг-Герой"); await pg.wait_for_timeout(300)
        print("btn-start enabled:", await pg.locator("#btn-start").is_enabled())
        await pg.locator("#btn-start").click(force=True)
        for t in range(10):
            await pg.wait_for_timeout(1500)
            st = await pg.evaluate("""()=>({
                loading: !document.getElementById('screen-loading').classList.contains('hidden'),
                ltext: document.getElementById('loading-text')?.textContent,
                game: !document.getElementById('screen-game').classList.contains('hidden'),
                hasGame: !!(window.__nvrGame && window.__nvrGame.scene),
                running: !!window.__nvrGame?.running,
            })""")
            print(t, st)
            if st["game"] or (st["ltext"] and "Застава не открылась" in str(st["ltext"])): break
        for l in logs[-25:]: print("LOG:", l)
        await b.close()
asyncio.run(main())
