export default {
  async fetch(request: Request, env: any) {
    const origin = request.headers.get("Origin") || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type,Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/api/getActiveMovies") {
      await env.cinema_db.prepare(
        "CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, cover_image TEXT, detail_images TEXT, genres TEXT, rating REAL)"
      ).run();
      await env.cinema_db.prepare(
        "CREATE TABLE IF NOT EXISTS showtimes (id INTEGER PRIMARY KEY, movie_id INTEGER NOT NULL, start_time TEXT NOT NULL, total_sold INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      const { results } = await env.cinema_db.prepare(
        "SELECT m.id as movie_id, m.title, m.description, m.cover_image, m.genres, m.rating, s.id as showtime_id, s.start_time, s.total_sold FROM movies m JOIN showtimes s ON s.movie_id = m.id WHERE date(s.start_time) = date('now') ORDER BY s.start_time ASC"
      ).all();
      const map = new Map<number, any>();
      for (const r of results || []) {
        const mid = Number((r as any).movie_id);
        if (!map.has(mid)) {
          map.set(mid, {
            id: mid,
            title: (r as any).title,
            description: (r as any).description ?? null,
            cover_image: (r as any).cover_image ?? null,
            genres: (r as any).genres ?? "[]",
            rating: (r as any).rating ?? null,
            duration_min: 0,
            release_date: new Date().toISOString(),
            showtimes: [],
          });
        }
        const arr = map.get(mid).showtimes as any[];
        arr.push({ id: (r as any).showtime_id, start_time: (r as any).start_time, total_sold: (r as any).total_sold ?? 0 });
      }
      const activeMovies = Array.from(map.values());
      return new Response(JSON.stringify({ activeMovies }), { headers: { "Content-Type": "application/json", ...cors } });
    }
    if (url.pathname.startsWith("/api/toys")) {
      await env.cinema_db.prepare(
        "CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, stock INTEGER, status TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      if (url.pathname === "/api/toys/active" && request.method === "GET") {
        const { results } = await env.cinema_db.prepare("SELECT * FROM toys WHERE lower(status) = 'active' ORDER BY datetime(created_at) DESC LIMIT 24").all();
        return new Response(JSON.stringify({ items: results || [] }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      if (url.pathname === "/api/toys" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 10);
        const q = url.searchParams.get("q") || "";
        const offset = (page - 1) * pageSize;
        const where = q ? "WHERE name LIKE ? OR category LIKE ?" : "";
        const bindQ = q ? [`%${q}%`, `%${q}%`, pageSize, offset] : [pageSize, offset];
        const { results } = await env.cinema_db.prepare(`SELECT * FROM toys ${where} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`).bind(...bindQ).all();
        let countRes;
        if (q) {
          ({ results: countRes } = await env.cinema_db.prepare("SELECT COUNT(1) as total FROM toys WHERE name LIKE ? OR category LIKE ?").bind(`%${q}%`, `%${q}%`).all());
        } else {
          ({ results: countRes } = await env.cinema_db.prepare("SELECT COUNT(1) as total FROM toys").all());
        }
        const total = (countRes?.[0]?.total as number) || 0;
        return new Response(JSON.stringify({ items: results || [], page, pageSize, total }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      if (url.pathname === "/api/toys" && request.method === "POST") {
        const body = await request.json();
        const name = String(body?.name || "");
        if (!name) return new Response(JSON.stringify({ message: "name required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        const category = body?.category ?? null;
        const price = Number(body?.price ?? 0);
        const stock = body?.stock != null ? Number(body?.stock) : null;
        const status = body?.status ?? "active";
        const image_url = body?.image_url ?? null;
        const resRun = await env.cinema_db.prepare("INSERT INTO toys (name, category, price, stock, status, image_url) VALUES (?, ?, ?, ?, ?, ?)").bind(name, category, price, stock, status, image_url).run();
        const lastId = (resRun as any)?.meta?.last_row_id || (resRun as any)?.lastRowId;
        const { results } = await env.cinema_db.prepare("SELECT * FROM toys WHERE id = ?").bind(lastId).all();
        return new Response(JSON.stringify({ toy: results?.[0] || null }), { status: 201, headers: { "Content-Type": "application/json", ...cors } });
      }
      const idMatchToy = url.pathname.match(/^\/api\/toys\/(\d+)$/);
      if (request.method === "PUT" && idMatchToy) {
        const id = Number(idMatchToy[1]);
        const body = await request.json();
        await env.cinema_db.prepare("UPDATE toys SET name = COALESCE(?, name), category = COALESCE(?, category), price = COALESCE(?, price), stock = COALESCE(?, stock), status = COALESCE(?, status), image_url = COALESCE(?, image_url) WHERE id = ?").bind(body?.name ?? null, body?.category ?? null, body?.price ?? null, body?.stock ?? null, body?.status ?? null, body?.image_url ?? null, id).run();
        const { results } = await env.cinema_db.prepare("SELECT * FROM toys WHERE id = ?").bind(id).all();
        return new Response(JSON.stringify({ toy: results?.[0] || null }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      if (request.method === "DELETE" && idMatchToy) {
        const id = Number(idMatchToy[1]);
        await env.cinema_db.prepare("DELETE FROM toys WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      return new Response(JSON.stringify({ message: "Not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
    }
    if (url.pathname.startsWith("/api/admin/transactions")) {
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      return new Response(JSON.stringify({ items: [], page, pageSize, total: 0 }), { headers: { "Content-Type": "application/json", ...cors } });
    }
    if (url.pathname === "/api/admin/dashboard/metrics") {
      const payload = { totalMovies: 0, totalShowtimes: 0, totalToys: 0, totalUsers: 0, totalTransactions: 0, revenueTotal: 0, revenueByMethod: { cash: 0, momo: 0, vnpay: 0 }, totalShowtimesToday: 0, totalShowtimesFuture: 0, occupancyTodayPercent: 0, topMoviesWeek: [] };
      return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json", ...cors } });
    }
    if (url.pathname.startsWith("/api/movies")) {
      await env.cinema_db.prepare(
        "CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, cover_image TEXT, detail_images TEXT, genres TEXT, rating REAL)"
      ).run();
      const idMatch = url.pathname.match(/^\/api\/movies\/(\d+)$/);
      if (request.method === "GET") {
        if (idMatch) {
          const id = Number(idMatch[1]);
          const { results } = await env.cinema_db.prepare("SELECT * FROM movies WHERE id = ?").bind(id).all();
          if (!results?.length) return new Response(JSON.stringify({ message: "Not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
          return new Response(JSON.stringify({ movie: results[0] }), { headers: { "Content-Type": "application/json", ...cors } });
        }
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 10);
        const q = url.searchParams.get("q") || "";
        const offset = (page - 1) * pageSize;
        const where = q ? "WHERE title LIKE ?" : "";
        const bindQ = q ? [`%${q}%`, pageSize, offset] : [pageSize, offset];
        const { results } = await env.cinema_db.prepare(`SELECT * FROM movies ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...bindQ).all();
        let countRes;
        if (q) {
          ({ results: countRes } = await env.cinema_db.prepare("SELECT COUNT(1) as total FROM movies WHERE title LIKE ?").bind(`%${q}%`).all());
        } else {
          ({ results: countRes } = await env.cinema_db.prepare("SELECT COUNT(1) as total FROM movies").all());
        }
        const total = (countRes?.[0]?.total as number) || 0;
        return new Response(JSON.stringify({ items: results || [], page, pageSize, total }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      if (request.method === "POST") {
        const body = await request.json();
        const title = String(body?.title || "");
        const description = typeof body?.description === "string" ? body.description : null;
        if (!title) return new Response(JSON.stringify({ message: "title required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        const resRun = await env.cinema_db.prepare("INSERT INTO movies (title, description) VALUES (?, ?)").bind(title, description).run();
        const lastId = (resRun as any)?.meta?.last_row_id || (resRun as any)?.lastRowId;
        const { results } = await env.cinema_db.prepare("SELECT * FROM movies WHERE id = ?").bind(lastId).all();
        return new Response(JSON.stringify({ movie: results?.[0] || null }), { status: 201, headers: { "Content-Type": "application/json", ...cors } });
      }
      if (request.method === "PUT" && idMatch) {
        const id = Number(idMatch[1]);
        const body = await request.json();
        const title = body?.title;
        const description = body?.description;
        await env.cinema_db.prepare("UPDATE movies SET title = COALESCE(?, title), description = COALESCE(?, description) WHERE id = ?").bind(title ?? null, description ?? null, id).run();
        const { results } = await env.cinema_db.prepare("SELECT * FROM movies WHERE id = ?").bind(id).all();
        return new Response(JSON.stringify({ movie: results?.[0] || null }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      if (request.method === "DELETE" && idMatch) {
        const id = Number(idMatch[1]);
        await env.cinema_db.prepare("DELETE FROM movies WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      return new Response(JSON.stringify({ message: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...cors } });
    }
    return new Response("Not found", { status: 404, headers: cors });
  },
};
