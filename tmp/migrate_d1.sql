CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, cover_image TEXT, detail_images TEXT, genres TEXT, rating REAL, duration_min INTEGER, release_date TEXT, is_active INTEGER DEFAULT 1);
DELETE FROM movies;
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (1, 'Halloween đêm cuối cùng', 'Phim về halloween, rùng rợn', '/uploads/movies/movie_1765630981061.png', '[]', '["kinh dị","ám ảnh"]', 6, 20, '2025-12-13T06:02:00.000Z', 1);
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (2, 'Thế giới khủng long', 'Con người đã dùng công nghệ mới để hồi sinh gen của khủng long, và trên một hòn đảo đã
ấp nở nhiều con khủng long, hình thành nên Đảo Khủng Long Jurassic.
Vào một ngày, chúng ta theo bước chân của Archi, bắt đầu một hành trình kỳ diệu khám phá
đảo khủng long.
Tại đây, chúng ta có thể tham quan và tiếp xúc gần với những loài khủng long sống từ thời
cổ đại: Pteranodon bay lượn trên bầu trời, khủng long ăn cỏ chạy tìm thức ăn—mọi thứ đều
thật hòa hợp.
Bất ngờ, cơn tấn công của Pteranodon và cuộc săn mồi của Tyrannosaurus làm gián đoạn
chuyến tham quan. Để tránh bị truy đuổi, chúng ta băng qua những hẻm núi hẹp, bay qua
thác nước dữ dội, và khi thoát khỏi đại hẻm, chứng kiến cảnh tượng di cư hùng vĩ của đàn
khủng long 。', '/uploads/movies/movie_1765631024266.jpeg', '[]', '["hành động","phiêu lưu","viễn tưởng"]', 7, 20, '2025-12-13T06:03:00.000Z', 1);
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (3, 'Thám hiểm biển sâu', 'Lần này, chúng ta sẽ cùng Chi Cốc khảo sát những thông tin đáng ngờ phát ra từ đáy đại
dương, mở ra một cuộc khám phá bí ẩn dưới biển sâu.
Tàu ngầm xuất phát từ căn cứ ven biển, bay vòng quanh các đảo, rồi rơi thẳng xuống vùng
biển nông. Khi lái tàu ngầm liên tục thám hiểm, chúng ta đi qua rạn san hô hình thành từ xác
cá voi. Bị cá mập tấn công, để tránh nguy hiểm, tàu ngầm đi sâu vào vùng biển sâu. Bất ngờ,
một con cá voi khổng lồ xuất hiện, dẫn chúng ta vào vùng biển bí ẩn.
Do bị tấn công, động cơ bị hỏng, và trong vùng biển bí ẩn, chúng ta chứng kiến một trận
chiến giữa quái vật biển khổng lồ và cá mập lớn. Nhân lúc hai sinh vật khổng lồ quấn nhau,
Aki kịp sửa xong động cơ, và chúng ta nhanh chóng rút lui, cuối cùng trở về an toàn căn cứ
biển sâu', '/uploads/movies/movie_1765697319487.webp', '[]', '["kinh dị","mạo hiểm"]', 8, 10, '2025-12-12T06:04:00.000Z', 1);
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (4, 'HÀNH TRÌNH GIỮA CÁC VÌ SAO', 'Thế giới tương lai
Sự phát triển của AI đã đạt đến mức chưa từng có. Trong những lần lặp
lại và tiến hóa liên tiếp, các siêu AI đã hình thành ý thức tự thân, khiến
xung đột giữa con người và AI ngày càng gia tăng, từ Trái Đất lan rộng
ra toàn bộ vũ trụ.
Để ngăn chặn tình trạng AI ngoài tầm kiểm soát, con người đã xây
dựng căn cứ không gian trên sao Hỏa, bí mật nghiên cứu vũ khí tối
thượng có thể vô hiệu hóa AI, đồng thời cử lực lượng tinh nhuệ thực
hiện nhiệm vụ khó khăn này. Dưới sự dẫn dắt của phi hành đoàn Bạch
Trạch, các chiến binh tinh nhuệ đã thoát khỏi sự truy đuổi của tàu địch,
bí mật giao nhận trong không gian, trải qua muôn trùng hiểm nguy,
xuyên qua lỗ sâu để đến bề mặt sao Hỏa, chuẩn bị hoàn thành nhiệm
vụ cuối cùng.
Tuy nhiên, sau một cơn bão mặt trời, giữa vũ trụ bao la chỉ còn lại một
khoảng lặng màu đen. Liệu nhiệm vụ có thể hoàn thành hay không?!', '/uploads/movies/movie_1765631173718.jpeg', '[]', '["viễn tưởng","khoa học"]', 9, 12, '2025-12-13T06:06:00.000Z', 1);
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (5, 'Vùng đất đỏ', 'Siêu tàu vũ trụ Chāoyuán đang thực hiện chuyến du hành giữa các vì sao
bất ngờ rơi vào hố đen, và vượt không gian tới hành tinh Kepler-22b cách
600 năm ánh sáng. Là một trong những hành tinh ngoài Trái Đất có khả
năng sinh sống cao nhất, ở đây xuất hiện những dao động năng lượng
mạnh mẽ trong lõi hành tinh. Hãy cùng hướng dẫn viên Bạch Trạch và
Chi Cốc thâm nhập vào lòng đất, tránh các đợt tấn công và hoàn thành
nhiệm vụ thăm dò!
Trò chơi sinh tử giữa người và máy | Chiến trường tối thượng giữa các vì
sao | Đội tinh nhuệ tập hợp | Căn cứ bí mật trên Sao Hỏa | Nghiên cứu vũ
khí tối thượng | Giao nhận bí mật trong không gian | Trải nghiệm du hành
qua lỗ sâu | Khủng hoảng bão mặt trời | Truy đuổi trong không gian | Bí ẩn
vũ trụ tĩnh lặng | Nhiệm vụ đầy kịch tính | Nhảy không gian liên sao | Nguy
hiểm trong vũ trụ chưa biết', '/uploads/movies/movie_1765631231149.jpeg', '[]', '["đất cát"]', 1, 12, '2025-12-13T06:07:00.000Z', 1);
INSERT INTO movies (id, title, description, cover_image, detail_images, genres, rating, duration_min, release_date, is_active) VALUES (6, 'TỀ THIÊN ĐẠI THÁNH', 'Câu chuyện được chuyển thể t ừ tác phẩm kinh điển Trung Quốc “Tây Du Ký”. Câu chuyện kể về Tôn Ngộ Không – Tề Thiên Đại Thánh, người được sinh ra t ừ linh thạch của tr ời đất, vốn đã định sẵn là phi thường. Ngài lên ngôi vua ở Hoa Quả S ơn, tập h ợp vô số khỉ yêu tinh, xây d ựng cho mình một vương quốc riêng. D ựa vào trí tuệ và tài năng, Tôn Ngộ Không lẻn vào Long Cung Đông Hải, tinh khôn lấy được Cân Đẩu Vương – trượng định hải thần. Ngộ Không t ự tin rằng mình có thể làm mọi việc, dám thách th ức quyền uy, không ng ừng theo đuổi t ự do và s ức mạnh. Ngài quậy phá Thiên Cung, d ựa vào thất thập nhị biến và Cân Đẩu Vân, cùng các vị thần Thiên đình tham gia nh ững trận đấu khốc liệt. S ự dũng cảm phi thường của Ngộ Không khiến các thần tiên phải nhìn nhận lại. Mặc dù cuối cùng bị Phật Nh ư Lai trấn dưới Ngũ Hành S ơn, nh ưng trải nghiệm huyền thoại và tinh thần không khuất phục của Ngài vẫn luôn thu hút và cảm h ứng cho thế hệ này đến thế hệ khác 。', '/uploads/movies/movie_1765697184783.webp', '[]', '["viễn tưởng"]', 9.4, 5, '2025-12-13T20:35:00.000Z', 1);
CREATE TABLE IF NOT EXISTS ticket_packages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, is_active INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
DELETE FROM ticket_packages;
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (1, 'Vé đơn', 300000, 1, 1, '2025-12-13T06:10:12.168Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (2, 'Vé đôi', 550000, 1, 2, '2025-12-13T06:11:27.834Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (3, 'Gói đơn thân', 450000, 1, 3, '2025-12-13T06:13:36.060Z');
INSERT INTO ticket_packages (id, name, price, is_active, display_order, created_at) VALUES (4, 'Vé gia đình', 720000, 1, 4, '2025-12-13T06:15:01.834Z');
CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL, stock INTEGER, status TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
DELETE FROM toys;