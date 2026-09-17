-- Metabase 용 뷰. 개인정보 컬럼을 뺀 것만 analyst 계정에 연다.
-- 비밀번호 없음. 이 파일은 그대로 공유해도 된다.

CREATE OR REPLACE VIEW v_user AS
SELECT id,
       status,
       CASE
         WHEN birth_year IS NULL THEN NULL
         WHEN YEAR(CURDATE()) - birth_year < 20 THEN '10대'
         WHEN YEAR(CURDATE()) - birth_year < 30 THEN '20대'
         WHEN YEAR(CURDATE()) - birth_year < 40 THEN '30대'
         ELSE '40대 이상'
       END AS age_band,
       DATE(created_at)   AS joined_on,
       DATE(last_seen_at) AS last_seen_on,
       DATE(withdrawn_at) AS withdrawn_on
FROM user;

CREATE OR REPLACE VIEW v_post AS
SELECT id, host_id, event_id, event_title, title, meet_at, meet_place,
       capacity, status, closed_reason, created_at
FROM companion_post;

CREATE OR REPLACE VIEW v_comment AS
SELECT id, post_id, author_id, parent_id, secret, status, created_at
FROM comment;

CREATE OR REPLACE VIEW v_report AS
SELECT id, reporter_id, target_type, target_id, reason, status,
       created_at, updated_at
FROM report;

CREATE OR REPLACE VIEW v_sanction AS
SELECT id, user_id, kind, issued_at, until, released_at
FROM sanction;

CREATE OR REPLACE VIEW v_event AS
SELECT id, external_id, source, kind, subject_type, subject, title,
       starts_on, ends_on, place_name, place_kind, region_id, created_at
FROM event;

-- Metabase 자기 저장소
CREATE DATABASE IF NOT EXISTS metabase CHARACTER SET utf8mb4;

SHOW FULL TABLES WHERE Table_type = 'VIEW';
