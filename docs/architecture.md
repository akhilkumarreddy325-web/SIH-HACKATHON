# Project Architecture

- `frontend/`: Expo + React Native + TypeScript application.
- `database/`: SQL migrations used to create/update database objects.
- `docs/`: Project documentation for development and jury presentation.

## Main frontend flow

`app` screens use reusable `components`, call logic in `services`, reuse `hooks`, and share data definitions from `types`.
