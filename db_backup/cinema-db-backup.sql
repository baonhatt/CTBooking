PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullname" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "gender" TEXT,
    "dob" DATETIME,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "users" VALUES(3,'hung','0935071405',NULL,'male','1997-12-06T00:00:00.000Z','2025-12-15T06:18:28.118Z','2025-12-18T03:08:20.823Z');
INSERT INTO "users" VALUES(4,'bin','',NULL,NULL,'2025-12-19T00:00:00.000Z','2025-12-15T06:23:55.164Z','2025-12-19T08:05:44.804Z');
INSERT INTO "users" VALUES(5,'Bin',NULL,NULL,NULL,NULL,'2025-12-16T06:30:38.614Z','2025-12-16T06:30:38.614Z');
INSERT INTO "users" VALUES(6,'khâm đẹp trai','0337526055',NULL,'male','2003-09-17T00:00:00.000Z','2025-12-16T07:36:21.918Z','2025-12-16T08:29:42.852Z');
INSERT INTO "users" VALUES(7,'phan thanh hung',NULL,NULL,NULL,NULL,'2025-12-16T09:31:56.512Z','2025-12-16T09:31:56.512Z');
INSERT INTO "users" VALUES(8,'sdfds',NULL,NULL,NULL,NULL,'2025-12-16T10:25:05.609Z','2025-12-16T10:25:05.609Z');
INSERT INTO "users" VALUES(9,'duong',NULL,NULL,NULL,NULL,'2025-12-16T10:25:39.378Z','2025-12-16T10:25:39.378Z');
INSERT INTO "users" VALUES(10,'hung','0935071405',NULL,NULL,NULL,'2025-12-16T16:03:43.891Z','2025-12-16T16:03:43.891Z');
INSERT INTO "users" VALUES(12,'hung8','0935071405',NULL,'male','1997-12-06T00:00:00.000Z','2025-12-18T02:57:06.618Z','2025-12-18T02:57:52.710Z');
INSERT INTO "users" VALUES(13,'hung hung',NULL,NULL,NULL,NULL,'2025-12-18 08:29:00','2025-12-18 08:29:00');
INSERT INTO "users" VALUES(14,'Lam Hu',NULL,NULL,NULL,NULL,'2025-12-18T09:01:56.316Z','2025-12-18T09:01:56.316Z');
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "login_type" TEXT NOT NULL DEFAULT 'email',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "accounts" VALUES(3,3,'hungmetaron2@gmail.com','$2b$10$Tnp9cGJ/3n/PvBZR82O1DeAAjbty64uqUTQDAN3KfsOnM9fn10tQ6','email',1,'2025-12-15T06:18:28.118Z','2025-12-15T06:18:28.118Z');
INSERT INTO "accounts" VALUES(4,4,'baonhat20@gmail.com','$2b$10$LwOdshMQSc3GZGVSMU3YHuSTGgnI1aJDuEt/BiBAv6BquI4MnOFjS','email',1,'2025-12-15T06:23:55.164Z','2025-12-15T06:23:55.164Z');
INSERT INTO "accounts" VALUES(5,5,'baonhat22@gmail.com','$2b$10$qWpK.iAWpnnIvgtsxRUuUe4Qv/zF1A8/DLHwFIV2w2W7P6B7VIiE2','email',1,'2025-12-16T06:30:38.614Z','2025-12-16T06:30:38.614Z');
INSERT INTO "accounts" VALUES(6,6,'dinhkham03@gmail.com','$2b$10$zUVzceNVdq7JDIpx10zMf.CvDQBRcgz9aUcuH.2.4/Pwqk4NsTvHm','email',1,'2025-12-16T07:36:21.918Z','2025-12-16T07:36:21.918Z');
INSERT INTO "accounts" VALUES(7,7,'ssthanhhung@gmail.com','$2b$10$oyHJjwJDy5ds6X9jXxR.PeL2F1WIkCm5bBncwyk1WoJ.SUqjqgBm.','email',1,'2025-12-16T09:31:56.512Z','2025-12-16T09:31:56.512Z');
INSERT INTO "accounts" VALUES(8,8,'asdasd@gmial.com','$2b$10$ZJYui3y5mbK2znSuYq1HbeYo7hBHtEUGq7ut5X9QBeiIiNHO0N4Fa','email',1,'2025-12-16T10:25:05.609Z','2025-12-16T10:25:05.609Z');
INSERT INTO "accounts" VALUES(9,9,'yifengquangdong@gmail.com','$2b$10$HZsqEqGReUvUVEwkD6yKLOKTq0N1AEiY759W6lga0aPcEJIcZq1XS','email',1,'2025-12-16T10:25:39.378Z','2025-12-16T10:25:39.378Z');
INSERT INTO "accounts" VALUES(11,12,'hung8@gmail.com','$2b$10$ieAdvLfLvgG2owQxRI3XruwkyiGuCHPjbnNCqdY4YQWwrc6ou8mzC','email',1,'2025-12-18T02:57:06.618Z','2025-12-18T02:57:06.618Z');
INSERT INTO "accounts" VALUES(12,13,'hung99@gmail.com','$2b$10$d25x0ssYtefdS4C1SE5m0Osp30vbyWnTsjRx5Ndn7uNlM78SjntMe','email',1,'2025-12-18 08:29:00','2025-12-18 08:29:00');
INSERT INTO "accounts" VALUES(13,14,'lamhui@gmail.com','$2b$10$7Ch7T0ZI63yiZI/I3tB1QuPIc71PuOQLe5CzI8whTTIzhdJZP3g7K','email',1,'2025-12-18T09:01:56.316Z','2025-12-18T09:01:56.316Z');
CREATE TABLE IF NOT EXISTS "tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expired_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "tokens" VALUES(1,3,'reset_password','5edc21ade620d0d00b69996126ade1a0183c2e9c3714b0ffea8c6ac25db7f0bb','2025-12-15T12:53:25.527Z','2025-12-15T11:53:25.527Z');
INSERT INTO "tokens" VALUES(2,3,'reset_password','6c9788fc3527ad764b421fa449ee5e4a1bde4226e92fa417646a6c2f6ace69c0','2025-12-15T15:40:05.427Z','2025-12-15T14:40:05.427Z');
INSERT INTO "tokens" VALUES(3,3,'reset_password','f4a90a032a145bd7de8fa67e71b30538492917b0adcffcf7155c7113cd07f695','2025-12-15T15:40:14.148Z','2025-12-15T14:40:14.148Z');
INSERT INTO "tokens" VALUES(4,3,'reset_password','573c0eea78576354a7ea7cc158e2a5876236d2fc003eca7fd190de8ef72f9e5a','2025-12-15T15:41:20.647Z','2025-12-15T14:41:20.647Z');
INSERT INTO "tokens" VALUES(5,3,'reset_password','633b5f43a7880e4f2489f634db278ceebf1b168819a72086ffe7db260be63965','2025-12-16T10:13:57.487Z','2025-12-16T09:13:57.487Z');
INSERT INTO "tokens" VALUES(6,3,'reset_password','c82286e1229039ef0b36dd95aa7d3caa5d8d6b8513db4c5ff52481b8ea49b09e','2025-12-16T10:14:27.296Z','2025-12-16T09:14:27.296Z');
INSERT INTO "tokens" VALUES(7,3,'reset_password','b61b0eaf2be9a49dd8fe23ad10a5fa2dc9f7fb38b4b2b8959f576b0dc25bc5ba','2025-12-16T10:24:18.837Z','2025-12-16T09:24:18.837Z');
INSERT INTO "tokens" VALUES(8,3,'reset_password','eedb772e260b2abe73d3b7ece740a33677506258a9628fb4059236f36aa82df1','2025-12-16T10:29:10.340Z','2025-12-16T09:29:10.340Z');
INSERT INTO "tokens" VALUES(9,3,'reset_password','f4bbf0ffa49a70bfd8638a4daa3582d573c2c9273c78a4615e1926a70efc48c0','2025-12-16T10:41:04.357Z','2025-12-16T09:41:04.357Z');
INSERT INTO "tokens" VALUES(10,3,'reset_password','f8f35abbf9f1d32d6b5c2372b339d1084fd2d045a0960bd099e274ccefac644a',1765979856,0);
INSERT INTO "tokens" VALUES(11,3,'reset_password','b98ea9cb344bac771f240089eece983e1a0f1a3626512414169b1faa1e70bf9b',1765980546,0);
INSERT INTO "tokens" VALUES(12,3,'reset_password','67b95a977bcb0418d4a6537f9915576869cb3746785877367767fdee11f093a8',1765981964,0);
INSERT INTO "tokens" VALUES(13,11,'reset_password','3b5679cdf1e457fed245e39684808100fa62f9c6a3f83595cdef10aefae0d1d9','2025-12-18T04:02:13.792Z','2025-12-18 03:02:13');
INSERT INTO "tokens" VALUES(14,11,'reset_password','0e1964b0aa83563c4cc6ecbfb5cf923140bdb3e8508ede275097af3356a7699e','2025-12-18T04:02:45.563Z','2025-12-18 03:02:45');
INSERT INTO "tokens" VALUES(15,3,'reset_password','95b9a33ae25d0de9cbbc10cd72adfdadb0b5e5cfed0db80a6101fbee2c6414a8','2025-12-19T05:16:48.366Z','2025-12-19 04:16:48');
CREATE TABLE IF NOT EXISTS "movies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "detail_images" JSONB,
    "genres" JSONB,
    "rating" DECIMAL,
    "duration_min" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT true,
    "release_date" DATETIME
);
INSERT INTO "movies" VALUES(1,'Halloween đêm cuối cùng','Phim về halloween, rùng rợn','https://res.cloudinary.com/dawifc4vx/image/upload/v1765875164/ctbooking/images/movies/mgmylsxtbbehcknlvrf9.webp','null',X'',8,5,'2025-12-15 02:15:31','2025-12-19T10:25:03.643Z',1,'2025-12-13T06:02:00.000Z');
INSERT INTO "movies" VALUES(2,'Thế giới khủng long',replace('Con người đã dùng công nghệ mới để hồi sinh gen của khủng long, và trên một hòn đảo đã\nấp nở nhiều con khủng long, hình thành nên Đảo Khủng Long Jurassic.\nVào một ngày, chúng ta theo bước chân của Archi, bắt đầu một hành trình kỳ diệu khám phá\nđảo khủng long.\nTại đây, chúng ta có thể tham quan và tiếp xúc gần với những loài khủng long sống từ thời\ncổ đại: Pteranodon bay lượn trên bầu trời, khủng long ăn cỏ chạy tìm thức ăn—mọi thứ đều\nthật hòa hợp.\nBất ngờ, cơn tấn công của Pteranodon và cuộc săn mồi của Tyrannosaurus làm gián đoạn\nchuyến tham quan. Để tránh bị truy đuổi, chúng ta băng qua những hẻm núi hẹp, bay qua\nthác nước dữ dội, và khi thoát khỏi đại hẻm, chứng kiến cảnh tượng di cư hùng vĩ của đàn\nkhủng long 。','\n',char(10)),'https://res.cloudinary.com/dawifc4vx/image/upload/v1765875108/ctbooking/images/movies/pv6jrxoi9i39x7judxka.webp','null','[]',7,20,'2025-12-15 02:15:31','2025-12-16T08:51:47.370Z',1,'2025-12-13T06:03:00.000Z');
INSERT INTO "movies" VALUES(3,'Thám hiểm biển sâu',replace('Lần này, chúng ta sẽ cùng Chi Cốc khảo sát những thông tin đáng ngờ phát ra từ đáy đại\ndương, mở ra một cuộc khám phá bí ẩn dưới biển sâu.\nTàu ngầm xuất phát từ căn cứ ven biển, bay vòng quanh các đảo, rồi rơi thẳng xuống vùng\nbiển nông. Khi lái tàu ngầm liên tục thám hiểm, chúng ta đi qua rạn san hô hình thành từ xác\ncá voi. Bị cá mập tấn công, để tránh nguy hiểm, tàu ngầm đi sâu vào vùng biển sâu. Bất ngờ,\nmột con cá voi khổng lồ xuất hiện, dẫn chúng ta vào vùng biển bí ẩn.\nDo bị tấn công, động cơ bị hỏng, và trong vùng biển bí ẩn, chúng ta chứng kiến một trận\nchiến giữa quái vật biển khổng lồ và cá mập lớn. Nhân lúc hai sinh vật khổng lồ quấn nhau,\nAki kịp sửa xong động cơ, và chúng ta nhanh chóng rút lui, cuối cùng trở về an toàn căn cứ\nbiển sâu','\n',char(10)),'https://res.cloudinary.com/dawifc4vx/image/upload/v1765875098/ctbooking/images/movies/c7kazddjc60r5jfbh4j2.webp','null','[]',8,10,'2025-12-15 02:15:31','2025-12-16T08:51:38.619Z',1,'2025-12-12T06:04:00.000Z');
INSERT INTO "movies" VALUES(4,'HÀNH TRÌNH GIỮA CÁC VÌ SAO',replace('Thế giới tương lai\nSự phát triển của AI đã đạt đến mức chưa từng có. Trong những lần lặp\nlại và tiến hóa liên tiếp, các siêu AI đã hình thành ý thức tự thân, khiến\nxung đột giữa con người và AI ngày càng gia tăng, từ Trái Đất lan rộng\nra toàn bộ vũ trụ.\nĐể ngăn chặn tình trạng AI ngoài tầm kiểm soát, con người đã xây\ndựng căn cứ không gian trên sao Hỏa, bí mật nghiên cứu vũ khí tối\nthượng có thể vô hiệu hóa AI, đồng thời cử lực lượng tinh nhuệ thực\nhiện nhiệm vụ khó khăn này. Dưới sự dẫn dắt của phi hành đoàn Bạch\nTrạch, các chiến binh tinh nhuệ đã thoát khỏi sự truy đuổi của tàu địch,\nbí mật giao nhận trong không gian, trải qua muôn trùng hiểm nguy,\nxuyên qua lỗ sâu để đến bề mặt sao Hỏa, chuẩn bị hoàn thành nhiệm\nvụ cuối cùng.\nTuy nhiên, sau một cơn bão mặt trời, giữa vũ trụ bao la chỉ còn lại một\nkhoảng lặng màu đen. Liệu nhiệm vụ có thể hoàn thành hay không?!','\n',char(10)),'https://res.cloudinary.com/dawifc4vx/image/upload/v1765875081/ctbooking/images/movies/hvpnqgj8jciuwen4qwrc.webp','null','[]',9,12,'2025-12-15 02:15:31','2025-12-16T08:51:21.441Z',1,'2025-12-13T06:06:00.000Z');
INSERT INTO "movies" VALUES(5,'Vùng đất đỏ',replace('Siêu tàu vũ trụ Chāoyuán đang thực hiện chuyến du hành giữa các vì sao\nbất ngờ rơi vào hố đen, và vượt không gian tới hành tinh Kepler-22b cách\n600 năm ánh sáng. Là một trong những hành tinh ngoài Trái Đất có khả\nnăng sinh sống cao nhất, ở đây xuất hiện những dao động năng lượng\nmạnh mẽ trong lõi hành tinh. Hãy cùng hướng dẫn viên Bạch Trạch và\nChi Cốc thâm nhập vào lòng đất, tránh các đợt tấn công và hoàn thành\nnhiệm vụ thăm dò!\nTrò chơi sinh tử giữa người và máy | Chiến trường tối thượng giữa các vì\nsao | Đội tinh nhuệ tập hợp | Căn cứ bí mật trên Sao Hỏa | Nghiên cứu vũ\nkhí tối thượng | Giao nhận bí mật trong không gian | Trải nghiệm du hành\nqua lỗ sâu | Khủng hoảng bão mặt trời | Truy đuổi trong không gian | Bí ẩn\nvũ trụ tĩnh lặng | Nhiệm vụ đầy kịch tính | Nhảy không gian liên sao | Nguy\nhiểm trong vũ trụ chưa biết','\n',char(10)),'https://res.cloudinary.com/dawifc4vx/image/upload/v1765875119/ctbooking/images/movies/dhlhcnpifm7me9xejzno.webp','null','[]',1,12,'2025-12-15 02:15:31','2025-12-16T15:03:01.149Z',1,'2025-12-13T06:07:00.000Z');
INSERT INTO "movies" VALUES(6,'TỀ THIÊN ĐẠI THÁNH','Câu chuyện được chuyển thể t ừ tác phẩm kinh điển Trung Quốc “Tây Du Ký”. Câu chuyện kể về Tôn Ngộ Không – Tề Thiên Đại Thánh, người được sinh ra t ừ linh thạch của tr ời đất, vốn đã định sẵn là phi thường. Ngài lên ngôi vua ở Hoa Quả S ơn, tập h ợp vô số khỉ yêu tinh, xây d ựng cho mình một vương quốc riêng. D ựa vào trí tuệ và tài năng, Tôn Ngộ Không lẻn vào Long Cung Đông Hải, tinh khôn lấy được Cân Đẩu Vương – trượng định hải thần. Ngộ Không t ự tin rằng mình có thể làm mọi việc, dám thách th ức quyền uy, không ng ừng theo đuổi t ự do và s ức mạnh. Ngài quậy phá Thiên Cung, d ựa vào thất thập nhị biến và Cân Đẩu Vân, cùng các vị thần Thiên đình tham gia nh ững trận đấu khốc liệt. S ự dũng cảm phi thường của Ngộ Không khiến các thần tiên phải nhìn nhận lại. Mặc dù cuối cùng bị Phật Nh ư Lai trấn dưới Ngũ Hành S ơn, nh ưng trải nghiệm huyền thoại và tinh thần không khuất phục của Ngài vẫn luôn thu hút và cảm h ứng cho thế hệ này đến thế hệ khác 。','https://res.cloudinary.com/dawifc4vx/image/upload/v1765875056/ctbooking/images/movies/a8nqptvpkzibv3fwvnif.webp','null','[]',9.4,5,'2025-12-15 02:15:31','2025-12-16T08:50:55.025Z',1,'2025-12-13T20:35:00.000Z');
INSERT INTO "movies" VALUES(7,'123','123','blob:https://6c956049.cinema-pages.pages.dev/db61c61f-dad5-479f-a941-734c8c108341',NULL,X'',NULL,12,'2025-12-19T07:47:14.960Z','2025-12-19T07:47:28.271Z',0,'2025-12-19T07:47:00.000Z');
INSERT INTO "movies" VALUES(8,'1231','1231','',NULL,X'',12,12,'2025-12-19T08:20:15.861Z','2025-12-19T09:18:34.131Z',0,'2025-12-19T08:20:00.000Z');
INSERT INTO "movies" VALUES(9,'123123123','qsdf','',NULL,X'',12,12,'2025-12-19T09:26:23.963Z','2025-12-19T09:28:23.054Z',0,'2025-12-19T09:26:00.000Z');
INSERT INTO "movies" VALUES(10,'123123123sdsdff','12123123123','',NULL,X'',NULL,12,'2025-12-19T09:28:59.292Z','2025-12-19T10:24:38.261Z',0,'2025-12-19T09:28:00.000Z');
INSERT INTO "movies" VALUES(11,'345345345','123123213','',NULL,X'',12,12,'2025-12-19T09:29:19.031Z','2025-12-19T10:24:16.085Z',0,'2025-12-19T09:29:00.000Z');
INSERT INTO "movies" VALUES(12,'123123','123123','',NULL,X'',NULL,10,'2025-12-19T10:19:54.057Z','2025-12-19T10:24:12.517Z',0,'2025-12-19T10:19:00.000Z');
INSERT INTO "movies" VALUES(13,'235345','345345','',NULL,X'',NULL,12,'2025-12-19T10:20:20.436Z','2025-12-19T10:24:09.114Z',0,'2025-12-19T10:20:00.000Z');
INSERT INTO "movies" VALUES(14,'1231233434ss','34534534ss','',NULL,X'',NULL,12,'2025-12-19T10:23:57.645Z','2025-12-19T10:24:04.939Z',0,'2025-12-19T10:23:00.000Z');
INSERT INTO "movies" VALUES(15,'123123345345','23423423423','',NULL,X'',NULL,12,'2025-12-19T10:26:37.592Z','2025-12-19T11:58:29.331Z',1,'2025-12-19T10:26:00.000Z');
INSERT INTO "movies" VALUES(16,'The Run ',NULL,'blob:https://cinesphere.com.vn/7eee12b3-de11-413c-9194-ad0ffb74238c',NULL,X'',NULL,12,'2025-12-19T12:02:39.913Z','2025-12-19T12:02:39.913Z',1,'2025-12-19T12:02:00.000Z');
CREATE TABLE IF NOT EXISTS "toys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "image_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ticket_packages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "price" DECIMAL NOT NULL,
    "features" JSONB,
    "type" TEXT,
    "min_group_size" INTEGER,
    "max_group_size" INTEGER,
    "is_member_only" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "display_order" INTEGER DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "ticket_packages" VALUES(1,'Combo Vé 2 Người','v2',NULL,450000,'[]','đôi',1,2,0,1,1,'2025-12-13T06:10:12.168Z','2025-12-15T04:37:57.714Z');
INSERT INTO "ticket_packages" VALUES(2,'1 Người lớn - 1 Trẻ em','V12',NULL,400000,'[]','lớn nhỏ',NULL,NULL,0,1,2,'2025-12-13T06:11:27.834Z','2025-12-15T04:39:10.737Z');
INSERT INTO "ticket_packages" VALUES(3,'Vé 2 Người lớn - 1 Trẻ em',NULL,NULL,550000,'[]','2 lớn, 1 nhỏ',NULL,NULL,0,1,3,'2025-12-13T06:13:36.060Z','2025-12-15T04:44:42.282Z');
INSERT INTO "ticket_packages" VALUES(4,'Vé 2 Người lớn - 2 Trẻ em',NULL,'2 lớn 2 nhỏ',650000,'[]',NULL,NULL,NULL,0,1,4,'2025-12-13T06:15:01.834Z','2025-12-16T15:03:51.117Z');
INSERT INTO "ticket_packages" VALUES(5,'Vé 1 người','Đơn',NULL,250000,'[]','1',NULL,NULL,0,1,0,'2025-12-16T06:41:37.042Z','2025-12-16T06:41:37.042Z');
CREATE TABLE site_media (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL, type TEXT NOT NULL, title TEXT, description TEXT, public_id TEXT, url TEXT NOT NULL, format TEXT, width INTEGER, height INTEGER, duration REAL, display_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "site_media" VALUES(11,'technology_section2','video',NULL,NULL,'ctbooking/videos/post4','https://res.cloudinary.com/dawifc4vx/video/upload/v1765889675/ctbooking/videos/post4.mp4','mp4',2160,3840,24.566667,0,1,'2025-12-16T12:54:40.535Z','2025-12-16T12:54:40.535Z');
INSERT INTO "site_media" VALUES(12,'hero_section','video',NULL,NULL,'ctbooking/videos/video','https://res.cloudinary.com/dawifc4vx/video/upload/v1765975930/ctbooking/videos/video.mp4','mp4',720,1280,41.212562,0,1,'2025-12-16T12:55:22.351Z',1765975931);
INSERT INTO "site_media" VALUES(13,'technology_section1','video',NULL,NULL,'ctbooking/videos/Post2','https://res.cloudinary.com/dawifc4vx/video/upload/v1765889746/ctbooking/videos/Post2.mp4','mp4',2160,3840,17.251995,0,1,'2025-12-16T12:55:50.768Z','2025-12-16T12:55:50.768Z');
INSERT INTO "site_media" VALUES(14,'technology_section2','video',NULL,NULL,'ctbooking/videos/post3','https://res.cloudinary.com/dawifc4vx/video/upload/v1765889777/ctbooking/videos/post3.mp4','mp4',2160,3840,24.566667,0,1,'2025-12-16T12:56:22.086Z','2025-12-16T12:56:22.086Z');
INSERT INTO "site_media" VALUES(15,'technology_section2','video',NULL,NULL,'ctbooking/videos/POST5','https://res.cloudinary.com/dawifc4vx/video/upload/v1765889947/ctbooking/videos/POST5.mp4','mp4',2160,3840,17.368005,0,1,'2025-12-16T12:59:11.587Z','2025-12-16T12:59:11.587Z');
INSERT INTO "site_media" VALUES(16,'technology_section2','video',NULL,NULL,'ctbooking/videos/POST6','https://res.cloudinary.com/dawifc4vx/video/upload/v1765890158/ctbooking/videos/POST6.mp4','mp4',2160,3840,15.487007,0,1,'2025-12-16T13:02:42.807Z','2025-12-16T13:02:42.807Z');
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,  -- Changed from NOT NULL to nullable
    "ticket_count" INTEGER NOT NULL DEFAULT 1,
    "total_price" REAL NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
    "paid_at" INTEGER,
    "payment_method" TEXT DEFAULT 'cash',
    "payment_status" TEXT DEFAULT 'pending',
    "transaction_id" TEXT,
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch()),
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "booking_code" TEXT UNIQUE,
    "is_used" INTEGER DEFAULT 0,
    "movie_id" INTEGER,
    "ticket_package_id" INTEGER,
    "expiry_date" INTEGER,
    CONSTRAINT "bookings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE CASCADE,
    CONSTRAINT "bookings_ticket_package_id_fkey" FOREIGN KEY ("ticket_package_id") REFERENCES "ticket_packages" ("id") ON DELETE SET NULL,
    CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);
INSERT INTO "bookings" VALUES(1,3,1,450000,'2025-12-15T06:50:57.537Z',NULL,'vnpay','pending',NULL,'2025-12-15 06:50:57','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,NULL);
INSERT INTO "bookings" VALUES(2,3,1,450000,'2025-12-15T08:34:50.831Z',NULL,'vnpay','pending',NULL,'2025-12-15 08:34:50','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,NULL);
INSERT INTO "bookings" VALUES(3,3,1,450000,'2025-12-15T08:34:58.053Z',NULL,'vnpay','pending',NULL,'2025-12-15 08:34:58','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,NULL);
INSERT INTO "bookings" VALUES(4,3,1,450000,'2025-12-15T08:49:48.597Z',NULL,'vnpay','pending',NULL,'2025-12-15 08:49:48','hung','0935071405','hungmetaron2@gmail.com',NULL,0,4,1,NULL);
INSERT INTO "bookings" VALUES(5,3,1,450000,'2025-12-15T08:59:59.300Z','2025-12-15T09:03:35.930Z','vnpay','paid','15345788','2025-12-15 08:59:59','hung','0935071405','hungmetaron2@gmail.com','MJFG5Q0L',0,6,1,'2025-12-25T09:03:35.930Z');
INSERT INTO "bookings" VALUES(6,4,1,400000,'2025-12-15T09:25:12.650Z',NULL,'momo','pending',NULL,'2025-12-15 09:25:12','bin','435435','baonhat20@gmail.com',NULL,0,6,2,NULL);
INSERT INTO "bookings" VALUES(7,3,1,450000,'2025-12-15T09:25:41.277Z','2025-12-15T09:27:17.127Z','vnpay','paid','15345841','2025-12-15 09:25:41','hung','0935071405','hungmetaron2@gmail.com','VJUVAXXZ',1,6,1,'2025-12-25T09:27:17.127Z');
INSERT INTO "bookings" VALUES(8,4,1,450000,'2025-12-15T10:33:16.101Z',NULL,'momo','pending',NULL,'2025-12-15 10:33:16','bin','36346','baonhat20@gmail.com',NULL,0,5,1,NULL);
INSERT INTO "bookings" VALUES(9,3,1,450000,'2025-12-15T11:59:27.673Z',NULL,'momo','pending',NULL,'2025-12-15 11:59:27','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,NULL);
INSERT INTO "bookings" VALUES(10,3,1,450000,'2025-12-15T12:52:23.206Z','2025-12-15T12:52:29.942Z','momo','failed','1765803147491','2025-12-15 12:52:23','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,'2025-12-25T12:52:29.942Z');
INSERT INTO "bookings" VALUES(11,3,1,450000,'2025-12-15T14:48:35.534Z','2025-12-15T14:48:41.960Z','momo','failed','1765810119561','2025-12-15 14:48:35','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,1,'2025-12-25T14:48:41.960Z');
INSERT INTO "bookings" VALUES(12,6,1,250000,'2025-12-16T07:40:36.498Z',NULL,'momo','pending',NULL,'2025-12-16 07:40:36','khâm đẹp trai','0337526055','dinhkham03@gmail.com',NULL,0,5,5,NULL);
INSERT INTO "bookings" VALUES(13,4,1,250000,'2025-12-16T09:05:04.506Z','2025-12-16T09:05:34.681Z','momo','paid','4630656656','2025-12-16 09:05:04','bin','98696','baonhat20@gmail.com','867QAFKR',0,6,5,'2025-12-26T09:05:34.681Z');
INSERT INTO "bookings" VALUES(14,4,1,550000,'2025-12-16T09:42:41.080Z','2025-12-16T09:43:31.143Z','momo','failed','4630681994','2025-12-16 09:42:41','bin','0972323423','baonhat20@gmail.com',NULL,0,1,3,'2025-12-26T09:43:31.143Z');
INSERT INTO "bookings" VALUES(15,4,1,250000,'2025-12-16T09:43:52.739Z','2025-12-16T09:44:09.895Z','momo','paid','4630701017','2025-12-16 09:43:52','bin','987986896','baonhat20@gmail.com','BV7XE177',0,6,5,'2025-12-26T09:44:09.895Z');
INSERT INTO "bookings" VALUES(16,3,1,250000,'2025-12-16T13:11:01.433Z','2025-12-16T13:11:21.368Z','vnpay','failed','0','2025-12-16 13:11:01','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,'2025-12-26T13:11:21.368Z');
INSERT INTO "bookings" VALUES(17,3,1,250000,'2025-12-16T13:16:29.593Z','2025-12-16T13:17:20.536Z','momo','paid','4630844714','2025-12-16 13:16:29','hung','0935071405','hungmetaron2@gmail.com','IU5YW7S0',0,5,5,'2025-12-26T13:17:20.536Z');
INSERT INTO "bookings" VALUES(18,3,1,250000,'2025-12-16T13:34:04.692Z','2025-12-16T13:35:19.690Z','momo','failed','4630855838','2025-12-16 13:34:04','hung','0935071405','hungmetaron2@gmail.com',NULL,0,4,5,'2025-12-26T13:35:19.690Z');
INSERT INTO "bookings" VALUES(19,3,5,1250000,'2025-12-16T13:36:50.839Z','2025-12-16T13:37:28.804Z','momo','paid','4630856151','2025-12-16 13:36:50','hung','0935071405','hungmetaron2@gmail.com','6VNRHGKC',0,2,5,'2025-12-26T13:37:28.804Z');
INSERT INTO "bookings" VALUES(20,9,1,250000,'2025-12-16T15:05:05.959Z',NULL,'momo','pending',NULL,'2025-12-16 15:05:05','duong','0888871194','yifengquangdong@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(21,10,1,250000,'2025-12-16T16:03:43.922Z',NULL,'momo','pending',NULL,'2025-12-16 16:03:43','hung','0935071405','hungmetaron2@gmail.com',NULL,0,5,5,NULL);
INSERT INTO "bookings" VALUES(32,9,1,250000,'2025-12-18T02:05:09.532Z',NULL,'momo','pending',NULL,'2025-12-18T02:05:09.532Z','dương','0888871194','yifengquangdong@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(35,3,1,250000,'2025-12-18 06:32:52',NULL,'momo','failed','1766040170130','2025-12-18T06:42:55.382Z','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(36,3,1,250000,'2025-12-18 06:45:27','2025-12-18T06:45:53.689Z','vnpay','paid','15352174','2025-12-18T06:45:54.790Z','hung','0935071405','hungmetaron2@gmail.com','JVF8VY2U',0,6,5,'2025-12-28T06:45:53.689Z');
INSERT INTO "bookings" VALUES(37,13,1,250000,'2025-12-18 08:30:36','2025-12-18T08:30:58.294Z','vnpay','paid','15352493','2025-12-18T08:30:59.459Z','hung99','0935071405','hung99@gmail.com','AXOL9PGG',0,6,5,'2025-12-28T08:30:58.294Z');
INSERT INTO "bookings" VALUES(38,4,1,550000,'2025-12-18 08:47:59','2025-12-18T08:49:43.283Z','vnpay','paid','15352563','2025-12-18T08:49:42.995Z','bin','056756774','baonhat20@gmail.com','CT73EFMS',0,4,3,'2025-12-28T08:49:43.283Z');
INSERT INTO "bookings" VALUES(39,14,1,550000,'2025-12-18T09:03:48.951Z','2025-12-18T09:04:58.860Z','vnpay','paid','15352620','2025-12-18T09:04:58.546Z','lamhui','03954352525','lamhui@gmail.com','6OOXXHKP',0,4,3,'2025-12-28T09:04:58.860Z');
INSERT INTO "bookings" VALUES(40,14,1,450000,'2025-12-18T09:18:09.429Z',NULL,'momo','failed','1766049498471','2025-12-18T09:18:22.678Z','lamhui','0233253245','lamhui@gmail.com',NULL,0,4,1,NULL);
INSERT INTO "bookings" VALUES(41,14,1,400000,'2025-12-18T09:20:33.780Z',NULL,'momo','failed','1766049639655','2025-12-18T09:20:44.911Z','lamhui','0546546456','lamhui@gmail.com',NULL,0,5,2,NULL);
INSERT INTO "bookings" VALUES(42,14,1,400000,'2025-12-18T10:57:32.761Z',NULL,'momo','failed','1766055485003','2025-12-18T10:58:09.375Z','Lam Hu','0948345345','lamhui@gmail.com',NULL,0,4,2,NULL);
INSERT INTO "bookings" VALUES(43,3,1,250000,'2025-12-18T12:57:47.776Z',NULL,'vnpay','pending',NULL,'2025-12-18T12:57:47.776Z','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(44,3,1,250000,'2025-12-18T12:57:54.114Z',NULL,'vnpay','pending',NULL,'2025-12-18T12:57:54.114Z','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(45,3,1,250000,'2025-12-18T13:27:57.499Z',NULL,'vnpay','failed','0','2025-12-18T13:28:02.997Z','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(46,3,1,250000,'2025-12-18T13:33:57.559Z',NULL,'vnpay','failed','0','2025-12-18T13:34:01.967Z','hung','0935071405','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(47,3,1,250000,'2025-12-18T13:35:49.112Z',NULL,'momo','failed','1766064973095','2025-12-18T13:36:16.932Z','hung','0234234234','hungmetaron2@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(48,NULL,1,250000,'2025-12-18T14:05:17.314Z',NULL,'vnpay','pending',NULL,'2025-12-18T14:05:17.314Z','vãn lai','0934867589','vanlai@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(49,NULL,1,400000,'2025-12-18T14:36:08.869Z',NULL,'momo','pending',NULL,'2025-12-18T14:36:08.869Z','hello mother','0233254353','baona@gmail.com',NULL,0,6,2,NULL);
INSERT INTO "bookings" VALUES(50,NULL,2,1300000,'2025-12-18T17:43:09.592Z',NULL,'momo','pending',NULL,'2025-12-18T17:43:09.592Z','Bin','0616465255','adminhjd@email.com',NULL,0,5,4,NULL);
INSERT INTO "bookings" VALUES(51,NULL,1,250000,'2025-12-19T01:48:37.105Z',NULL,'vnpay','pending',NULL,'2025-12-19T01:48:37.105Z','thanh hải','0934678987','hai@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(52,NULL,1,250000,'2025-12-19T02:30:02.358Z',NULL,'vnpay','pending',NULL,'2025-12-19T02:30:02.358Z','đặt bậy','0935678987','datbay@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(53,NULL,1,250000,'2025-12-19T02:42:35.521Z',NULL,'vnpay','pending',NULL,'2025-12-19T02:42:35.521Z','văn lai 3','0912123123','vanlai3@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(54,NULL,1,250000,'2025-12-19T02:56:43.131Z',NULL,'vnpay','pending',NULL,'2025-12-19T02:56:43.131Z','vãng lai 9','0935071405','vanglai9@gmail.com',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(55,NULL,1,250000,'2025-12-19T02:58:30.295Z','2025-12-19T02:58:51.219Z','vnpay','paid','15353891','2025-12-19T02:58:52.039Z','vãng lai 10','0934567678','vanglai10@gmail.com','3RZDFLZ8',0,6,5,'2025-12-29T02:58:51.219Z');
INSERT INTO "bookings" VALUES(56,NULL,1,250000,'2025-12-19T07:25:25.996Z',NULL,'vnpay','failed','0','2025-12-19T07:25:31.130Z','123','0123123123','123@gmail.co,',NULL,0,6,5,NULL);
INSERT INTO "bookings" VALUES(57,NULL,1,450000,'2025-12-19T07:44:52.306Z','2025-12-19T07:45:09.510Z','vnpay','paid','15354551','2025-12-19T07:45:10.524Z','vãng lai 987','0956789165','vanglai987@gmail.com','VXAMOY8F',0,6,1,'2025-12-29T07:45:09.510Z');
INSERT INTO "bookings" VALUES(58,NULL,1,450000,'2025-12-19T11:56:28.976Z','2025-12-19T11:57:09.724Z','momo','paid','4633442278','2025-12-19T11:57:11.665Z','ac','0938475893','baona345@gmail.com','6EN4406D',0,6,1,'2025-12-29T11:57:09.724Z');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('movies',16);
INSERT INTO "sqlite_sequence" VALUES('ticket_packages',5);
INSERT INTO "sqlite_sequence" VALUES('users',14);
INSERT INTO "sqlite_sequence" VALUES('accounts',13);
INSERT INTO "sqlite_sequence" VALUES('tokens',15);
INSERT INTO "sqlite_sequence" VALUES('site_media',23);
INSERT INTO "sqlite_sequence" VALUES('toys',1);
INSERT INTO "sqlite_sequence" VALUES('bookings',58);
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");
CREATE UNIQUE INDEX "tokens_token_key" ON "tokens"("token");
CREATE UNIQUE INDEX "ticket_packages_code_key" ON "ticket_packages"("code");
