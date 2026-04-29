import smtplib

from email.message import EmailMessage
from externalAPI.Constants import Constants as C

"""
This module provides functionality to send emails using Gmail's SMTP server. It defines a function `send_email` that takes the recipient's email address, subject, and body of the email as parameters. The function constructs an email message and sends it using the SMTP protocol.
Author: Jonas Dorner (@OilersLD)

Important Information: You need to create a .env file named "login_data.env" in the root of your project (3 levels up from this file) with the following content:
    GMAIL_USER="the_email_adresse"
    GMAIL_APP_PASSWORD="the_app_password"
And don't commit this file
"""

def _to_text(x) -> str:
    """
    Converts a value to a string representation, handling special cases like None, tuples, and lists.
    """
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    if isinstance(x, (tuple, list)):
        # join Strings sauber; alles andere sicher zu str()
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