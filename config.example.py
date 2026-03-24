SECRET_KEY = "replace-with-your-secret-key"

MYSQL_HOST = "localhost"
MYSQL_USER = "root"
MYSQL_PASSWORD = "replace-with-your-db-password"
MYSQL_PORT = 3306
MYSQL_DB = "water_quality"
SQLALCHEMY_DATABASE_URI = (
    f"mysql+mysqldb://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    "?charset=utf8mb4"
)

# Mail configuration
MAIL_SERVER = "smtp.qq.com"
MAIL_USE_SSL = True
MAIL_PORT = 465
MAIL_USERNAME = "your-email@example.com"
MAIL_PASSWORD = "replace-with-your-mail-app-password"
MAIL_DEFAULT_SENDER = MAIL_USERNAME
