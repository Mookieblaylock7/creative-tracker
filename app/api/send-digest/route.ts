import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, newProjects = [], statusChanges = [], dateChanges = [] } = await request.json();

    if (!to) return NextResponse.json({ error: "Missing email recipient" }, { status: 400 });

    const newProjectsHtml = newProjects.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #58a6ff; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #30363d; padding-bottom: 4px;">
          🆕 New Projects Announced
        </h3>
        ${newProjects.map((item) => `
          <div style="background-color: #161b22; border: 1px solid #30363d; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: bold; color: #ffffff; font-size: 15px;">${item.title}</div>
            <div style="color: #79c0ff; font-size: 12px; margin-top: 4px;">Matched: ${item.matchedCredits}</div>
            <div style="color: #8b949e; font-size: 12px; margin-top: 2px;">Status: <span style="color: #d29922;">${item.status || "Announced"}</span> · Release: ${item.releaseDate || "TBA"}</div>
          </div>
        `).join("")}
      </div>
    ` : "";

    const statusChangesHtml = statusChanges.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #d29922; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #30363d; padding-bottom: 4px;">
          🎬 Production Status Changes
        </h3>
        ${statusChanges.map((item) => `
          <div style="background-color: #161b22; border: 1px solid #30363d; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: bold; color: #ffffff; font-size: 15px;">${item.title}</div>
            <div style="color: #79c0ff; font-size: 12px; margin-top: 4px;">Matched: ${item.matchedCredits}</div>
            <div style="color: #8b949e; font-size: 12px; margin-top: 2px;">Changed: <span style="color: #f85149;">${item.oldStatus}</span> ➔ <span style="color: #3fb950; font-weight: bold;">${item.newStatus}</span></div>
          </div>
        `).join("")}
      </div>
    ` : "";

    const dateChangesHtml = dateChanges.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #a5d6ff; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #30363d; padding-bottom: 4px;">
          📅 Release Date Moves
        </h3>
        ${dateChanges.map((item) => `
          <div style="background-color: #161b22; border: 1px solid #30363d; padding: 12px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: bold; color: #ffffff; font-size: 15px;">${item.title}</div>
            <div style="color: #79c0ff; font-size: 12px; margin-top: 4px;">Matched: ${item.matchedCredits}</div>
            <div style="color: #8b949e; font-size: 12px; margin-top: 2px;">Moved: <span style="color: #8b949e; text-decoration: line-through;">${item.oldDate}</span> ➔ <span style="color: #58a6ff; font-weight: bold;">${item.newDate}</span></div>
          </div>
        `).join("")}
      </div>
    ` : "";

    const fullHtml = `
      <div style="background-color: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #30363d; padding-bottom: 16px;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0;">MY FILM PEOPLE</h1>
          <p style="color: #8b949e; font-size: 12px; margin-top: 4px;">Weekly Creative Digest Updates</p>
        </div>
        ${newProjectsHtml}
        ${statusChangesHtml}
        ${dateChangesHtml}
        <div style="text-align: center; border-top: 1px solid #30363d; padding-top: 16px; margin-top: 24px; color: #8b949e; font-size: 11px;">
          You are receiving this digest based on your email preferences at <a href="https://myfilmpeople.app" style="color: #58a6ff;">myfilmpeople.app</a>.
        </div>
      </div>
    `;

    const data = await resend.emails.send({
      from: "My Film People <updates@myfilmpeople.app>",
      to,
      subject: "🎬 Your Film Digest: New updates for creators you follow",
      html: fullHtml,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
