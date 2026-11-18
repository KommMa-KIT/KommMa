"""
EMail_Service.py

Sends mails through Gmail's SMTP server. Used for admin notifications
(e.g. from the custom exceptions).
Author: Jonas Dorner (@OilersLD)

Credentials are read from "login_data.env" in the project root:
    GMAIL_USER="the_email_adresse"
    GMAIL_APP_PASSWORD="the_app_password"
Do not commit this file.
"""

import smtplib

from email.message import EmailMessage
from externalAPI.Constants import Constants as C

def _to_text(x) -> str:
    """
    Converts a value to a string. None becomes "", tuples and lists are joined.
    """
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    if isinstance(x, (tuple, list)):
        return "".join(item if isinstance(item, str) else str(item) for item in x)
    return str(x)


def send_email(to_email: str, subject: str, body: str):
    body = _to_text(body) + _to_text(C.FOOTER_EMAIL)
    ergebnis = C.GMAIL_CREDENTIALS
    from_email, password = ergebnis
    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(C.SMTP_SERVER, C.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(from_email, password)
        server.send_message(msg)

    print("Mail gesendet an ", to_email, " mit Betreff: ", subject)

def send_admin_email(subject: str, body: str):
    admin_email = C.ADMIN_EMAIL
    send_email(admin_email, subject, body)