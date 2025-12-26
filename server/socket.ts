import { Server } from "socket.io";
import { type Express } from "express";

export function initSocket(httpServer: any, app: Express) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "*", // Cho phép mọi nguồn trong quá trình dev/preview (bạn có thể thay bằng các domain cụ thể bên dưới để bảo mật hơn)
        "http://localhost:5173",
        "https://preview.cinema-pages.pages.dev",
        "http://localhost:8080",
        "https://cinema-pages.pages.dev"
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Lưu io instance vào app để dùng ở Webhook sau này (req.app.get('io'))
  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  console.log("Socket.IO initialized!");
  return io;
}
