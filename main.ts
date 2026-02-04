import { parse } from "node-html-parser"
import { writeFile, readFile } from 'fs/promises'

interface Notice {
    nep_date: string
    title: string
    link: string
}

async function main() {
    const response = await fetch("https://exam.ioe.tu.edu.np/notices")
    const data = await response.text()
    const html = parse(data)

    const notices = await Promise.all(html.querySelectorAll(".recent-post-wrapper").map(async (notice) => {
        const nep_date = notice.querySelector(".nep_date")?.textContent.trim() || ""
        const title = notice.querySelector(".detail")?.textContent.trim() || ""
        const noticeLink = notice.querySelector("a")?.getAttribute("href") || ""
        const res = await fetch(noticeLink)
        const html2 = parse(await res.text())
        const link = html2.querySelectorAll('a').find(a => a.textContent.trim() === "Click here to view the full notice.")?.getAttribute("href") || noticeLink
        return { nep_date, title, link }
    }))
    const old_notices = new Set<string>(JSON.parse(await readFile('./data/notices.json', 'utf-8')).map((notice: Notice) => JSON.stringify(notice)))
    const new_notices = notices.filter((notice: Notice) => !old_notices.has(JSON.stringify(notice)))
    await writeFile('./data/notices.json', JSON.stringify(notices, null, 4))
    if (new_notices.length > 0) await notifyAdmin(new_notices)
}

async function notifyAdmin(new_notices: Notice[]) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chat_id = process.env.TELEGRAM_CHAT_ID

    if (!token || !chat_id) {
        console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables")
        return
    }
    for (const notice of new_notices) {
        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id,
                    text: `<b>${notice.nep_date}</b>\n${notice.title}\n\n<a href="${notice.link}">🔗 View Notice</a>`,
                    parse_mode: "HTML"
                })
            })
        } catch (error) {
            console.error(`Failed to send notice: ${notice.title}`, error)
        }
    }
}

main()