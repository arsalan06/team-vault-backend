CREATE TABLE users (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id          CHAR(36)    NOT NULL PRIMARY KEY,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  user_id     CHAR(36)    NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE verification_tokens (
  id          CHAR(36)    NOT NULL PRIMARY KEY,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  user_id     CHAR(36)    NOT NULL,
  type        ENUM('EMAIL_VERIFY', 'PASSWORD_RESET') NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspaces (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  storage_used   BIGINT       NOT NULL DEFAULT 0,
  storage_limit  BIGINT       NOT NULL DEFAULT 1073741824,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE memberships (
  id            CHAR(36)    NOT NULL PRIMARY KEY,
  user_id       CHAR(36)    NOT NULL,
  workspace_id  CHAR(36)    NOT NULL,
  role          ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_workspace (user_id, workspace_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invites (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  workspace_id  CHAR(36)     NOT NULL,
  role          ENUM('ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  token_hash    CHAR(64)     NOT NULL UNIQUE,
  expires_at    DATETIME(3)  NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE files (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  original_name   VARCHAR(255) NOT NULL,
  stored_name     VARCHAR(100) NOT NULL UNIQUE,
  mime_type       VARCHAR(100) NOT NULL,
  size            BIGINT       NOT NULL,
  hash            CHAR(64)     NULL,
  thumbnail_path  VARCHAR(255) NULL,
  status          ENUM('PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
  workspace_id    CHAR(36)     NOT NULL,
  uploader_id     CHAR(36)     NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_files_workspace_created (workspace_id, created_at),
  INDEX idx_files_hash (hash),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
  id          CHAR(36)    NOT NULL PRIMARY KEY,
  body        TEXT        NOT NULL,
  file_id     CHAR(36)    NOT NULL,
  author_id   CHAR(36)    NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_comments_file (file_id, created_at),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id            CHAR(36)    NOT NULL PRIMARY KEY,
  body          TEXT        NOT NULL,
  workspace_id  CHAR(36)    NOT NULL,
  author_id     CHAR(36)    NOT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_messages_workspace_created (workspace_id, created_at),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id          CHAR(36)    NOT NULL PRIMARY KEY,
  user_id     CHAR(36)    NOT NULL,
  type        VARCHAR(50) NOT NULL,
  payload     JSON        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_notifications_user (user_id, is_read, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webhooks (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  url             VARCHAR(500) NOT NULL,
  secret          CHAR(64)     NOT NULL,
  events          JSON         NOT NULL,
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  failure_count   INT          NOT NULL DEFAULT 0,
  workspace_id    CHAR(36)     NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE import_jobs (
  id             CHAR(36)    NOT NULL PRIMARY KEY,
  workspace_id   CHAR(36)    NOT NULL,
  status         ENUM('QUEUED', 'RUNNING', 'DONE', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  rows_total     INT         NOT NULL DEFAULT 0,
  rows_imported  INT         NOT NULL DEFAULT 0,
  rows_failed    INT         NOT NULL DEFAULT 0,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE imported_records (
  id             BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  import_job_id  CHAR(36) NOT NULL,
  data           JSON     NOT NULL,
  INDEX idx_imported_job (import_job_id),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;