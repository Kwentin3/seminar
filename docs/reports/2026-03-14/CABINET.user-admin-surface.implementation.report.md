# CABINET User Admin Surface Implementation Report

- Date: 2026-03-14
- Scope: cabinet admin-only user management for lecturer/viewer accounts
- Mode: code / test / docs
- Status: implemented locally, verified in automated test and local browser smoke

## 1. Executive Summary

В cabinet добавлен минимальный admin-only user management slice без расширения продуктового scope:

1. список пользователей кабинета;
2. создание нового lecturer account с ролью `viewer`;
3. сброс пароля;
4. включение и отключение доступа;
5. запрет на self-deactivate;
6. принудительная инвалидация active sessions после password reset и deactivate.

Изменение сделано как естественное расширение существующего cabinet-admin surface, а не как отдельная подсистема. Новая точка входа: `/cabinet/admin/users`.

## 2. Problem Statement

До изменения у проекта не было удобного app-native способа создавать и обслуживать lecturer/viewer accounts. Практически это означало:

1. добавление пользователей через прямую работу с SQLite;
2. использование внутренних hash helpers вручную;
3. ops-heavy процесс для простых admin задач;
4. отсутствие безопасного, повторяемого UI/API path для user onboarding.

Для daily cabinet operations это было уже неудобно и плохо масштабировалось.

## 3. Implemented Scope

В реализованный MVP вошло:

1. `GET /api/cabinet/admin/users`
2. `POST /api/cabinet/admin/users`
3. `POST /api/cabinet/admin/users/:id/reset-password`
4. `POST /api/cabinet/admin/users/:id/set-active`
5. admin-only cabinet page `/cabinet/admin/users`
6. contracts для user admin API
7. локализация RU/EN
8. integration test coverage
9. smoke coverage alignment
10. docs updates

Сознательно не вошло:

1. создание admin accounts из GUI;
2. удаление пользователей;
3. редактирование email/username;
4. audit log/history UI;
5. role hierarchy beyond existing `admin | viewer`;
6. bulk user import;
7. invitation flow;
8. passwordless or email-based onboarding.

## 4. Architecture Fit

### 4.1. Why this shape

Выбран минимальный shape с viewer-first creation. Это уменьшает риск privilege escalation и хорошо ложится в уже существующую роль-модель cabinet.

### 4.2. Server split

Business logic вынесена в отдельный server-side service:

- [admin-users.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/admin-users.mjs)

HTTP handling и auth gate остались в:

- [index.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/index.mjs)

Такой split сохраняет понятную границу:

1. route layer отвечает за auth, response shape и obs logging;
2. service layer отвечает за validation, DB writes и domain rules.

### 4.3. Data model

Новая migration не понадобилась. Использованы уже существующие таблицы:

1. `users`
2. `sessions`

Это позволило реализовать slice без schema drift.

## 5. API Surface

### 5.1. List users

`GET /api/cabinet/admin/users`

Поведение:

1. доступно только `admin`;
2. возвращает current users list;
3. сортирует `admin` выше `viewer`;
4. не раскрывает `password_hash`.

### 5.2. Create viewer

`POST /api/cabinet/admin/users`

Input:

1. `username`
2. `email`
3. `password`

Поведение:

1. нормализует username/email в lowercase;
2. валидирует минимальную длину password;
3. проверяет uniqueness по username/email;
4. создаёт только `viewer`.

### 5.3. Reset password

`POST /api/cabinet/admin/users/:id/reset-password`

Поведение:

1. меняет `password_hash`;
2. обновляет `updated_at`;
3. немедленно удаляет все sessions target user;
4. тем самым делает reset terminal и проверяемым.

### 5.4. Set active

`POST /api/cabinet/admin/users/:id/set-active`

Поведение:

1. переключает `is_active`;
2. при deactivate удаляет sessions пользователя;
3. запрещает self-deactivate текущему admin session owner.

## 6. UI Surface

Основной экран:

- [CabinetUserAdminPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetUserAdminPage.tsx)

Навигация добавлена в:

- [CabinetPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetPage.tsx)
- [CabinetLlmSettingsPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetLlmSettingsPage.tsx)
- [router.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/app/router.tsx)

### 6.1. Primary user problem

Экран решает одну задачу: дать администратору быстрый и безопасный способ управлять lecturer/viewer accounts без прямого доступа к БД.

### 6.2. Primary action

Главное действие экрана: создать нового lecturer account.

### 6.3. Explicit UI states

Явно представлены:

1. `loading`
2. `forbidden`
3. `error`
4. `empty`
5. `ready`

Также для действий есть:

1. `busy` state на create;
2. `busy` state на password reset;
3. `busy` state на activate/deactivate;
4. terminal feedback через status message.

### 6.4. Interaction hierarchy

Action hierarchy зафиксирована так:

1. primary: create lecturer;
2. secondary: reset password;
3. secondary but more sensitive: activate/deactivate;
4. navigation: back to library / open llm settings.

Deactivate не сделан primary action по умолчанию.

## 7. Sticky Comments Added

Небольшие “липкие” комментарии оставлены только там, где важно сохранить инварианты:

1. viewer-only creation scope:
   - [admin-users.mjs#L160](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/admin-users.mjs#L160)
2. mandatory session invalidation after password reset:
   - [admin-users.mjs#L222](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/admin-users.mjs#L222)
3. self-deactivate lockout guard:
   - [admin-users.mjs#L262](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/admin-users.mjs#L262)

Это не декоративные comments, а короткие reminders о product/security intent.

## 8. Contracts

В contracts добавлены типы и схемы для нового surface:

- [index.ts](/d:/Users/Roman/Desktop/Проекты/seminar/packages/contracts/src/index.ts)

Добавлено:

1. `cabinetAdminUserSchema`
2. `cabinetAdminUsersResponseSchema`
3. `createCabinetAdminViewerRequestSchema`
4. `resetCabinetAdminUserPasswordRequestSchema`
5. `setCabinetAdminUserActiveRequestSchema`
6. `cabinetAdminUserMutationResponseSchema`

Это устраняет ad-hoc payload handling на client side.

## 9. Security Notes

### 9.1. Implemented protections

Реализованы следующие ограничения:

1. весь surface admin-only;
2. UI дополнительно проверяет current session role;
3. create flow не позволяет создать `admin` из GUI;
4. password reset invalidates sessions immediately;
5. deactivate invalidates sessions immediately;
6. self-deactivate запрещён;
7. password hash никогда не уходит в response.

### 9.2. Remaining security caveats

Пока остаются ограничения:

1. нет dedicated audit trail по user-management actions;
2. нет forced password policy beyond minimum length;
3. нет invite flow или email verification;
4. reset password выполняется через plain admin input, а не через one-time token flow.

Для текущего internal cabinet scope это допустимо, но важно не перепутать это с public-scale IAM.

## 10. Testing and Verification

### 10.1. New integration coverage

Добавлен новый integration test:

- [cabinet-admin-users.integration.test.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/tests/cabinet/cabinet-admin-users.integration.test.mjs)

Что он подтверждает:

1. admin может получить users list;
2. admin может создать viewer;
3. созданный viewer может войти;
4. viewer не имеет доступа к admin users API;
5. admin может reset password;
6. old session viewer becomes invalid after reset;
7. old password stops working;
8. new password works;
9. admin может deactivate viewer;
10. inactive viewer loses access;
11. admin может reactivate viewer;
12. reactivated viewer can login again;
13. self-deactivate returns `403`.

### 10.2. Full cabinet suite

Обновлён общий cabinet test command:

- [package.json](/d:/Users/Roman/Desktop/Проекты/seminar/package.json)

Проверено:

1. `pnpm exec node --test tests/cabinet/cabinet-admin-users.integration.test.mjs`
2. `pnpm run test:cabinet`
3. `pnpm run typecheck`
4. `pnpm run build`

Все эти проверки прошли успешно.

### 10.3. Browser smoke

Browser smoke теперь проверяет и новый admin surface:

- [test-smoke-cabinet-browser.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet-browser.mjs)

Подтверждено:

1. login works;
2. `/cabinet/admin/users` renders;
3. heading and create action are visible;
4. existing reading flow still works;
5. simplify flow smoke remains green;
6. logout still works.

### 10.4. API smoke caveat

`test:smoke:cabinet` был точечно обновлён, чтобы при admin login также проверять `GET /api/cabinet/admin/users`:

- [test-smoke-cabinet.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet.mjs)

Но этот script, как и раньше, требует отдельно поднятый local server. Сам по себе он не self-managed. Поэтому его падение без runtime на `127.0.0.1:8787` не считается регрессией данного change.

## 11. Documentation Updates

Обновлены:

1. [README.md](/d:/Users/Roman/Desktop/Проекты/seminar/README.md)
2. [CABINET_LOCAL_SMOKE.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/CABINET_LOCAL_SMOKE.md)

Что зафиксировано в docs:

1. наличие нового admin users surface;
2. участие `/cabinet/admin/users` в local smoke baseline;
3. обновлённый manual fallback для cabinet verification.

## 12. Files Created or Updated

### 12.1. Created

1. [admin-users.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/admin-users.mjs)
2. [CabinetUserAdminPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetUserAdminPage.tsx)
3. [cabinet-admin-users.integration.test.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/tests/cabinet/cabinet-admin-users.integration.test.mjs)
4. [CABINET.user-admin-surface.implementation.report.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/reports/2026-03-14/CABINET.user-admin-surface.implementation.report.md)

### 12.2. Updated

1. [index.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/index.mjs)
2. [index.ts](/d:/Users/Roman/Desktop/Проекты/seminar/packages/contracts/src/index.ts)
3. [messages.ts](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/app/messages.ts)
4. [router.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/app/router.tsx)
5. [CabinetPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetPage.tsx)
6. [CabinetLlmSettingsPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetLlmSettingsPage.tsx)
7. [package.json](/d:/Users/Roman/Desktop/Проекты/seminar/package.json)
8. [README.md](/d:/Users/Roman/Desktop/Проекты/seminar/README.md)
9. [CABINET_LOCAL_SMOKE.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/CABINET_LOCAL_SMOKE.md)
10. [test-smoke-cabinet-browser.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet-browser.mjs)
11. [test-smoke-cabinet.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet.mjs)

## 13. Risks and Limitations

Главные текущие ограничения:

1. create flow intentionally limited to `viewer`;
2. нет audit history UI и action journaling;
3. нет edit profile flow;
4. нет delete flow;
5. `test:smoke:cabinet` всё ещё зависит от внешне поднятого runtime;
6. change пока verified locally, но не rolled out to live within this task.

## 14. Readiness Judgement

Для текущего internal cabinet scope изменение готово как локально верифицированный implementation slice.

Основания:

1. API и UI path завершены end-to-end;
2. domain rules проверены integration test;
3. browser smoke остался зелёным;
4. docs и smoke expectations приведены к одному baseline;
5. product scope остался узким и управляемым.

## 15. Recommended Next Step

Следующий логичный шаг:

1. выкатить текущий slice на stage-safe или production contour;
2. пройти live GUI smoke:
   - login as admin
   - open `/cabinet/admin/users`
   - create test lecturer
   - login as lecturer
   - reset password
   - deactivate/reactivate
3. после этого считать прямой SQLite path для создания lecturers запасным ops-only fallback, а не основным способом работы.
