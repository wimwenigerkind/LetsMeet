----------------------------------------------------------
-- 👤 User Login
----------------------------------------------------------
-- Checkt, ob Martin mit E-Mail und Passwort existiert (Login)
SELECT id, first_name, last_name
FROM users
WHERE email = 'martin.forster@web.ork';
 -- AND password = 'superSecret123'; (Wenn Passwörter angegeben sind)


----------------------------------------------------------
-- 🆕 Konto erstellen
----------------------------------------------------------
-- Legt einen neuen User an (Registrierung)
INSERT INTO users (email, password, first_name, last_name, phone_number, gender, birth_date)
VALUES ('neuer.user@example.com', 'pw123', 'Lena', 'Müller', '0123456789', 'weiblich', '1999-05-10');


----------------------------------------------------------
-- 👯‍♂️ Freund hinzufügen (nur wenn beide zustimmen)
----------------------------------------------------------
-- Martin (User 1) schickt Freundschaftsanfrage an Elina (User 2)
INSERT INTO friendships (user_id_1, user_id_2, status)
VALUES (1, 2, 'pending');

-- Elina akzeptiert Freundschaftsanfrage
UPDATE friendships
SET status = 'accepted'
WHERE user_id_1 = 1 AND user_id_2 = 2;

----------------------------------------------------------
-- 🔎 Alle Nutzer finden
----------------------------------------------------------
SELECT *
FROM users;

----------------------------------------------------------
-- 🔎 Nutzer mit ähnlichen Interessen finden
----------------------------------------------------------
-- Findet andere User mit denselben Hobbies wie Martin
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
-- Martin schreibt Elina eine Nachricht
INSERT INTO messages (conversation_id, sender_user_id, message_text)
VALUES (3, 1, 'Hallo Elina, wie geht’s dir?');


----------------------------------------------------------
-- 📜 Name + Hobbies von einem User anzeigen
----------------------------------------------------------
-- Holt Name und alle Hobbies von Elina
SELECT u.first_name, u.last_name, h.name AS hobby, h.rating
FROM users u
         LEFT JOIN hobbies h ON u.id = h.user_id
WHERE u.email = 'tsanaklidou.elina@1mal1.te';


----------------------------------------------------------
-- 🖼 Foto hochladen / ändern / löschen
----------------------------------------------------------
-- Martin lädt ein neues Foto hoch
INSERT INTO user_photos (user_id, url, is_profile_picture)
VALUES (1, 'https://meinserver.com/martin_profil.jpg', true);

-- Profilbild ändern (altes auf false setzen, neues auf true)
UPDATE user_photos
SET is_profile_picture = false
WHERE user_id = 1;

INSERT INTO user_photos (user_id, url, is_profile_picture)
VALUES (1, 'https://meinserver.com/martin_neues_profilbild.jpg', true);

-- Foto löschen
DELETE FROM user_photos
WHERE id = 5 AND user_id = 1;


----------------------------------------------------------
-- 📝 Eigene Stammdaten ändern
----------------------------------------------------------
-- Elina ändert Telefonnummer
UPDATE users
SET phone_number = '06221 99999',
    updated_at = now()
WHERE email = 'tsanaklidou.elina@1mal1.te';


----------------------------------------------------------
-- 🎯 Eigene Hobbies ändern
----------------------------------------------------------
-- Martin fügt ein Hobby hinzu
INSERT INTO hobbies (user_id, name, rating)
VALUES (1, 'Fremdsprachenkenntnisse erweitern', 78);

-- Elina passt Hobby-Rating an
UPDATE hobbies
SET rating = 60
WHERE user_id = 2 AND name = 'Mir die Probleme von anderen anhören';

-- Elina löscht ein Hobby
DELETE FROM hobbies
WHERE user_id = 2 AND name = 'Für einen guten Zweck spenden';


----------------------------------------------------------
-- 👑 Admin: alle Daten bearbeiten
----------------------------------------------------------
-- Admin setzt Martins Passwort zurück
UPDATE users
SET password = 'newSecurePW'
WHERE email = 'martin.forster@web.ork';

-- Adresse löschen
DELETE FROM addresses
WHERE user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Hobbies löschen
DELETE FROM hobbies
WHERE user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Fotos löschen
DELETE FROM user_photos
WHERE user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Freundschaften löschen
DELETE FROM friendships
WHERE user_id_1 = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te')
   OR user_id_2 = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Likes löschen
DELETE FROM likes
WHERE liker_user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te')
   OR liked_user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Nachrichten löschen
DELETE FROM messages
WHERE sender_user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Conversations Zuordnungen löschen
DELETE FROM conversations_users
WHERE user_id = (SELECT id FROM users WHERE email = 'tsanaklidou.elina@1mal1.te');

-- Am Ende User löschen
DELETE FROM users
WHERE email = 'tsanaklidou.elina@1mal1.te';
