----------------------------------------------------------
-- 👤 User Login
----------------------------------------------------------
-- Checkt, ob ein User mit E-Mail und Passwort existiert (Login)
SELECT id, first_name, last_name
FROM users
WHERE email = 'test@example.com'
  AND password = 'superSecret123';


----------------------------------------------------------
-- 🆕 Konto erstellen
----------------------------------------------------------
-- Legt einen neuen User an (Registrierung)
INSERT INTO users (email, password, first_name, last_name, phone_number, gender, birth_date)
VALUES ('neuer.user@example.com', 'pw123', 'Lena', 'Müller', '0123456789', 'weiblich', '1999-05-10');


----------------------------------------------------------
-- 👯‍♂️ Freund hinzufügen (nur wenn beide zustimmen)
----------------------------------------------------------
-- User 1 schickt Freundschaftsanfrage an User 2
INSERT INTO friendships (user_id_1, user_id_2, status)
VALUES (1, 2, 'pending');

-- User 2 akzeptiert Freundschaftsanfrage
UPDATE friendships
SET status = 'accepted'
WHERE user_id_1 = 1 AND user_id_2 = 2;


----------------------------------------------------------
-- 🔎 Nutzer mit ähnlichen Interessen finden
----------------------------------------------------------
-- Findet andere User mit denselben Hobbies wie User 1
SELECT u.id, u.first_name, u.last_name, h.name AS hobby
FROM users u
         JOIN hobbies h ON u.id = h.user_id
WHERE h.name IN (
    SELECT name FROM hobbies WHERE user_id = 1
)
  AND u.id != 1;


----------------------------------------------------------
-- 💬 Andere Teilnehmer kontaktieren (Nachricht schreiben)
----------------------------------------------------------
-- Nachricht in bestehendem Chat absenden
INSERT INTO messages (conversation_id, sender_user_id, message_text)
VALUES (3, 1, 'Hey, wie geht’s dir?');


----------------------------------------------------------
-- 📜 Name + Hobbies von einem User anzeigen
----------------------------------------------------------
-- Holt Name und alle Hobbies eines Users
SELECT u.first_name, u.last_name, h.name AS hobby, h.rating
FROM users u
         LEFT JOIN hobbies h ON u.id = h.user_id
WHERE u.id = 2;


----------------------------------------------------------
-- 🖼 Foto hochladen / ändern / löschen
----------------------------------------------------------
-- Neues Foto hochladen
INSERT INTO user_photos (user_id, url, is_profile_picture)
VALUES (1, 'https://meinserver.com/foto1.jpg', true);

-- Profilbild ändern (altes auf false setzen, neues auf true)
UPDATE user_photos
SET is_profile_picture = false
WHERE user_id = 1;

INSERT INTO user_photos (user_id, url, is_profile_picture)
VALUES (1, 'https://meinserver.com/neues_profilbild.jpg', true);

-- Foto löschen
DELETE FROM user_photos
WHERE id = 5 AND user_id = 1;


----------------------------------------------------------
-- 📝 Eigene Stammdaten ändern
----------------------------------------------------------
-- User 1 ändert Nachname + Telefonnummer
UPDATE users
SET last_name = 'Schneider',
    phone_number = '01761234567',
    updated_at = now()
WHERE id = 1;


----------------------------------------------------------
-- 🎯 Eigene Hobbies ändern
----------------------------------------------------------
-- Hobby hinzufügen
INSERT INTO hobbies (user_id, name, rating)
VALUES (1, 'Klettern', 5);

-- Hobby anpassen (z. B. Rating ändern)
UPDATE hobbies
SET rating = 4
WHERE user_id = 1 AND name = 'Klettern';

-- Hobby löschen
DELETE FROM hobbies
WHERE user_id = 1 AND name = 'Klettern';


----------------------------------------------------------
-- 👑 Admin: alle Daten bearbeiten
----------------------------------------------------------
-- Admin ändert Userdaten (z. B. Passwort zurücksetzen)
UPDATE users
SET password = 'newSecurePW'
WHERE id = 3;

-- Admin löscht einen User komplett
DELETE FROM users
WHERE id = 5;
