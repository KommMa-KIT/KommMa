# E-Mail Service

## Overview
The E-Mail Service sends out e-mails to a defined admin e-mail.

## Methods
### sendEmail 
bash``` send_email(TARGET, SUBJECT, BODY) ```
Here the TARGET is the e-mail address of the recipient, SUBJECT is the subject of the e-mail and BODY is the content of the e-mail.
This method is not directly used in the codebase, but is called by the `send_email_to_admin` method.
### send_email_to_admin
bash``` send_email_to_admin(SUBJECT, BODY) ```
This method sends an e-mail to the defined admin e-mail address. The SUBJECT is the subject of the e-mail and BODY is the content of the e-mail. This method is used in the codebase to send e-mails to the admin e-mail address.
The admin e-mail address is defined in the `.env` file with the variable `ADMIN_EMAIL`.
To get more information about the `.env`, please refer to the `README-env.md` file.

## Requierments
To use the E-Mail Service, you need to have a valid GMAIL account and the credentials for that account. 
The credentials are defined in the `.env` file with the variables `EMAIL_USER` and `EMAIL_PASSWORD`.
The `EMAIL_PASSWORD` is an app password that you can generate in your GMAIL account settings.
The e-mail service uses these credentials to authenticate with the e-mail server and send e-mails.

## Possible Error
If the credentials are invalid, the e-mail service will not be able to authenticate with the e-mail server and will throw an error.