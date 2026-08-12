from flask import Flask, render_template, request, jsonify
import os
import json
from datetime import datetime
import smtplib
from email.message import EmailMessage
from werkzeug.utils import secure_filename
import mimetypes
from pypdf import PdfReader


app = Flask(__name__)


# ============================================================
# EMAIL CONFIGURATION
# ============================================================

# Email address can remain configured on the backend.
SENDER_EMAIL = os.getenv(
    "SENDER_EMAIL",
    "chiragp2597@gmail.com"
)

# NEVER put the Gmail App Password directly in this file.
# Set it as an environment variable instead.
SENDER_PASSWORD = os.getenv(
    "SENDER_PASSWORD",
    ""
)

EMAIL_SERVICE = "Gmail"


# ============================================================
# PATH CONFIGURATION
# ============================================================

UPLOAD_FOLDER = os.path.join(
    app.root_path,
    "uploads"
)

LEADS_FILE = os.path.join(
    UPLOAD_FOLDER,
    "leads.json"
)

app.config["UPLOAD_FOLDER"] = "uploads"

os.makedirs(
    app.config["UPLOAD_FOLDER"],
    exist_ok=True
)


# ============================================================
# LEAD STORAGE
# ============================================================

def load_leads():

    if not os.path.exists(LEADS_FILE):
        return []

    try:

        with open(
            LEADS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except (json.JSONDecodeError, OSError) as error:

        print("LEADS LOAD ERROR:", error)

        return []


def save_leads(leads):

    with open(
        LEADS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            leads,
            file,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# CREATE UNIQUE LEAD ID
# ============================================================

def generate_lead_id(leads):

    existing_ids = []

    for lead in leads:

        try:
            existing_ids.append(
                int(lead.get("id", 0))
            )

        except (TypeError, ValueError):
            pass

    timestamp_id = int(
        datetime.now().timestamp() * 1000
    )

    if existing_ids:
        return max(
            timestamp_id,
            max(existing_ids) + 1
        )

    return timestamp_id


# ============================================================
# PDF LEAD PARSER
# ============================================================

def parse_pdf_leads(text):

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    try:

        start_index = lines.index("Company")

    except ValueError:

        print(
            "Could not find Company header in PDF."
        )

        return []


    # Expected columns:
    #
    # Company
    # Contact
    # Email
    # Country
    # Interest

    data_lines = lines[
        start_index + 5:
    ]


    new_leads = []


    for i in range(
        0,
        len(data_lines),
        5
    ):

        if i + 4 >= len(data_lines):
            break


        company = data_lines[i]

        contact = data_lines[i + 1]

        email = data_lines[i + 2]

        country = data_lines[i + 3]

        interest = data_lines[i + 4]


        # Ignore anything that isn't an email
        if "@" not in email:
            continue


        # Clean PDF email formatting
        email = email.replace(
            "[",
            ""
        )

        email = email.replace(
            "]",
            ""
        )

        email = email.replace(
            "\\",
            ""
        )


        if "mailto:" in email:

            email = email.split(
                "mailto:"
            )[-1]


        email = email.strip()


        new_leads.append({

            "company": company,

            "owner": contact,

            "contact": contact,

            "email": email,

            "phone": "",

            "country": country,

            "interest": interest,

            "source": "PDF",

            "score": 0,

            "contacted": False

        })


    print(
        f"PARSED PDF LEADS: {len(new_leads)}"
    )


    return new_leads


# ============================================================
# EMAIL SENDING
# ============================================================

def send_email(
    recipient,
    subject,
    message,
    attachment_path=None
):

    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    email_service = "Gmail"


    # ========================================================
    # SMTP CONFIGURATION
    # ========================================================

    if email_service == "Gmail":

        smtp_server = "smtp.gmail.com"

        smtp_port = 587

    else:

        smtp_server = "smtp.gmail.com"

        smtp_port = 587


    # ========================================================
    # VALIDATE CREDENTIALS
    # ========================================================

    if not sender_email:

        raise Exception(
            "Sender email is not configured."
        )


    if not sender_password:

        raise Exception(
            "Sender password is not configured."
        )


    # ========================================================
    # CREATE EMAIL
    # ========================================================

    email = EmailMessage()

    email["From"] = sender_email

    email["To"] = recipient

    email["Subject"] = subject

    email.set_content(
        message
    )


    # ========================================================
    # ATTACHMENT
    # ========================================================

    if attachment_path:

        if not os.path.exists(
            attachment_path
        ):

            raise Exception(
                "Attachment file not found."
            )


        with open(
            attachment_path,
            "rb"
        ) as file:

            file_data = file.read()


        attachment_filename = os.path.basename(
            attachment_path
        )


        mime_type, _ = mimetypes.guess_type(
            attachment_filename
        )


        if mime_type:

            maintype, subtype = mime_type.split(
                "/",
                1
            )

        else:

            maintype = "application"

            subtype = "octet-stream"


        email.add_attachment(

            file_data,

            maintype=maintype,

            subtype=subtype,

            filename=attachment_filename

        )


    # ========================================================
    # CONNECT TO GMAIL
    # ========================================================

    with smtplib.SMTP(
        smtp_server,
        smtp_port,
        timeout=20
    ) as server:

        server.starttls()

        server.login(
            sender_email,
            sender_password
        )

        server.send_message(
            email
        )


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return render_template(
        "index.html"
    )


@app.route("/favicon.ico")
def favicon():
    return "", 204


# ============================================================
# PDF UPLOAD
# ============================================================

@app.route(
    "/upload-pdf",
    methods=["POST"]
)
def upload_pdf():

    # ========================================================
    # CHECK FILE
    # ========================================================

    if "file" not in request.files:

        return jsonify({

            "success": False,

            "message":
                "No PDF file uploaded."

        }), 400


    file = request.files["file"]


    if file.filename == "":

        return jsonify({

            "success": False,

            "message":
                "No PDF file selected."

        }), 400


    if not file.filename.lower().endswith(
        ".pdf"
    ):

        return jsonify({

            "success": False,

            "message":
                "Only PDF files are allowed."

        }), 400


    try:

        # ====================================================
        # SAVE PDF
        # ====================================================

        filename = secure_filename(
            file.filename
        )


        pdf_path = os.path.join(

            app.config[
                "UPLOAD_FOLDER"
            ],

            filename

        )


        file.save(
            pdf_path
        )


        # ====================================================
        # READ PDF
        # ====================================================

        reader = PdfReader(
            pdf_path
        )


        extracted_pages = []


        for page in reader.pages:

            text = page.extract_text()

            if text:

                extracted_pages.append(
                    text
                )


        extracted_text = "\n".join(
            extracted_pages
        )


        # ====================================================
        # CHECK EXTRACTION
        # ====================================================

        if not extracted_text.strip():

            return jsonify({

                "success": False,

                "message":
                    "Could not extract text from this PDF."

            }), 400


        # ====================================================
        # PARSE PDF LEADS
        # ====================================================

        parsed_leads = parse_pdf_leads(
            extracted_text
        )


        # ====================================================
        # SAVE ONLY NEW LEADS
        # ====================================================

        existing_leads = load_leads()


        added_count = 0

        duplicate_count = 0


        # Build a set of existing emails
        existing_emails = set()


        for existing_lead in existing_leads:

            existing_email = (
                existing_lead
                .get("email", "")
                .strip()
                .lower()
            )


            if existing_email:

                existing_emails.add(
                    existing_email
                )


        for lead in parsed_leads:

            email = (
                lead
                .get("email", "")
                .strip()
                .lower()
            )


            # Skip leads without email
            if not email:

                continue


            # =================================================
            # DUPLICATE CHECK
            # =================================================

            if email in existing_emails:

                duplicate_count += 1

                print(
                    f"SKIPPED DUPLICATE PDF LEAD: {email}"
                )

                continue


            # =================================================
            # CREATE ID
            # =================================================

            lead["id"] = generate_lead_id(
                existing_leads
            )


            # =================================================
            # NORMALIZE FIELDS
            # =================================================

            lead.setdefault(
                "owner",
                lead.get(
                    "contact",
                    ""
                )
            )

            lead.setdefault(
                "phone",
                ""
            )

            lead.setdefault(
                "score",
                0
            )

            lead.setdefault(
                "contacted",
                False
            )

            lead["source"] = "PDF"


            # =================================================
            # ADD LEAD
            # =================================================

            existing_leads.append(
                lead
            )


            existing_emails.add(
                email
            )


            added_count += 1


        # ====================================================
        # SAVE DATABASE
        # ====================================================

        if added_count > 0:

            save_leads(
                existing_leads
            )


        print(
            f"PDF LEADS ADDED: {added_count}"
        )

        print(
            f"PDF DUPLICATES SKIPPED: {duplicate_count}"
        )


        # ====================================================
        # SAVE EXTRACTED TEXT
        # ====================================================

        text_file = os.path.join(

            app.config[
                "UPLOAD_FOLDER"
            ],

            "extracted_pdf.txt"

        )


        with open(

            text_file,

            "w",

            encoding="utf-8"

        ) as output_file:

            output_file.write(
                extracted_text
            )


        # ====================================================
        # RESPONSE
        # ====================================================

        return jsonify({

            "success": True,

            "message":
                "PDF uploaded and processed successfully.",

            "filename":
                filename,

            "pages":
                len(reader.pages),

            "text":
                extracted_text,

            "added":
                added_count,

            "duplicates":
                duplicate_count

        })


    except Exception as error:

        print(
            "PDF EXTRACTION ERROR:",
            error
        )


        return jsonify({

            "success": False,

            "message":
                "Could not process the PDF."

        }), 500


# ============================================================
# GET ALL LEADS
# ============================================================

@app.route(
    "/leads",
    methods=["GET"]
)
def get_leads():

    leads = load_leads()


    return jsonify({

        "success": True,

        "leads": leads,

        "count": len(leads)

    })


# ============================================================
# ADD SINGLE LEAD
# ============================================================

@app.route(
    "/leads",
    methods=["POST"]
)
def add_lead():

    data = request.get_json(
        silent=True
    ) or {}


    email = (
        data
        .get("email", "")
        .strip()
    )


    if not email:

        return jsonify({

            "success": False,

            "message":
                "Email is required."

        }), 400


    leads = load_leads()


    # ========================================================
    # DUPLICATE EMAIL CHECK
    # ========================================================

    existing = next(

        (

            lead

            for lead in leads

            if lead
            .get("email", "")
            .strip()
            .lower()
            ==
            email.lower()

        ),

        None

    )


    if existing:

        return jsonify({

            "success": True,

            "message":
                "Lead already exists.",

            "lead":
                existing

        })


    # ========================================================
    # CREATE LEAD
    # ========================================================

    lead = {

        "id":
            generate_lead_id(
                leads
            ),

        "company":
            data.get(
                "company",
                ""
            ),

        "contact":
            data.get(
                "contact",
                ""
            ),

        "owner":
            data.get(
                "contact",
                ""
            ),

        "email":
            email,

        "phone":
            data.get(
                "phone",
                ""
            ),

        "country":
            data.get(
                "country",
                ""
            ),

        "interest":
            data.get(
                "interest",
                ""
            ),

        "source":
            data.get(
                "source",
                "Search"
            ),

        "score":
            data.get(
                "score",
                0
            ),

        "contacted":
            False

    }


    leads.append(
        lead
    )


    save_leads(
        leads
    )


    return jsonify({

        "success": True,

        "message":
            "Lead added successfully.",

        "lead":
            lead

    })


# ============================================================
# DELETE LEAD
# ============================================================

@app.route(
    "/leads/<int:lead_id>",
    methods=["DELETE"]
)
def delete_lead(
    lead_id
):

    leads = load_leads()


    lead = next(

        (

            lead

            for lead in leads

            if lead.get("id") == lead_id

        ),

        None

    )


    if not lead:

        return jsonify({

            "success": False,

            "message":
                "Lead not found."

        }), 404


    leads = [

        lead

        for lead in leads

        if lead.get("id") != lead_id

    ]


    save_leads(
        leads
    )


    return jsonify({

        "success": True,

        "message":
            "Lead deleted successfully."

    })


# ============================================================
# SEND EMAIL TO LEAD
# ============================================================

@app.route("/leads/<int:lead_id>/send", methods=["POST"])
def send_lead(lead_id):

    leads = load_leads()

    lead = next(
        (lead for lead in leads if lead.get("id") == lead_id),
        None
    )

    if not lead:
        return jsonify({
            "success": False,
            "message": "Lead not found."
        }), 404

    try:

        send_email(
            lead["email"],
            request.json.get(
                "subject",
                "Partnership Opportunity"
            ),
            request.json.get(
                "message",
                "Hello, I would like to discuss a potential partnership."
            )
        )

        lead["contacted"] = True

        save_leads(leads)

        return jsonify({
            "success": True,
            "message": "Email sent successfully.",
            "lead": lead
        })

    except Exception as error:

        print(
            f"Email failed for {lead.get('email')}: {error}"
        )

        return jsonify({
            "success": False,
            "message": str(error),
            "lead": lead
        }), 500


@app.route("/leads/reset", methods=["POST"])
def reset_leads():

    try:
        # Load current leads
        leads = load_leads()

        deleted_count = len(leads)

        # Clear all leads
        save_leads([])

        return jsonify({
            "success": True,
            "message": "Database reset successfully.",
            "deleted": deleted_count
        })

    except Exception as error:

        print("RESET DATABASE ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Could not reset database."
        }), 500


    # ========================================================
    # GET EMAIL TEMPLATE
    # ========================================================

    data = request.get_json(
        silent=True
    ) or {}


    subject = data.get(

        "subject",

        "Partnership Opportunity"

    ).strip()


    message = data.get(

        "message",

        ""

    ).strip()


    if not subject:

        return jsonify({

            "success": False,

            "message":
                "Email subject is required."

        }), 400


    if not message:

        return jsonify({

            "success": False,

            "message":
                "Email message is required."

        }), 400


    # ========================================================
    # SEND EMAIL
    # ========================================================

    try:

        send_email(

            recipient=lead["email"],

            subject=subject,

            message=message

        )


        # Only mark contacted after successful sending
        lead["contacted"] = True


        save_leads(
            leads
        )


        print(
            f"Email sent to {lead['email']}"
        )


        return jsonify({

            "success": True,

            "message":
                "Email sent successfully.",

            "lead":
                lead

        })


    except Exception as error:

        print(

            f"EMAIL SEND ERROR for "
            f"{lead.get('email')}:",

            error

        )


        return jsonify({

            "success": False,

            "message":
                str(error)

        }), 500


# ============================================================
# EMAIL STATUS
# ============================================================

@app.route(
    "/email-status",
    methods=["GET"]
)
def email_status():

    if not SENDER_EMAIL or not SENDER_PASSWORD:

        return jsonify({

            "success": True,

            "connected": False,

            "email": None,

            "message":
                "Email sender is not configured."

        })


    try:

        with smtplib.SMTP(

            "smtp.gmail.com",

            587,

            timeout=10

        ) as server:

            server.starttls()

            server.login(

                SENDER_EMAIL,

                SENDER_PASSWORD

            )


        return jsonify({

            "success": True,

            "connected": True,

            "email":
                SENDER_EMAIL,

            "service":
                "Gmail"

        })


    except Exception as error:

        print(
            "EMAIL CONNECTION ERROR:",
            error
        )


        return jsonify({

            "success": True,

            "connected": False,

            "email":
                SENDER_EMAIL,

            "service":
                "Gmail",

            "message":
                "Unable to connect to Gmail."

        })


# ============================================================
# SEARCH LEADS
# ============================================================

@app.route(
    "/search-leads",
    methods=["POST"]
)
def search_leads():

    data = request.get_json(
        silent=True
    ) or {}


    query = (
        data
        .get("query", "")
        .strip()
    )


    country = (
        data
        .get("country", "")
        .strip()
    )


    try:

        limit = int(
            data.get(
                "limit",
                10
            )
        )

    except (
        TypeError,
        ValueError
    ):

        limit = 10


    # Keep limit reasonable
    limit = max(
        1,
        min(limit, 100)
    )


    if not query:

        return jsonify({

            "success": False,

            "message":
                "Search query is required."

        }), 400


    # ========================================================
    # TEMPORARY MOCK SEARCH RESULTS
    # ========================================================

    mock_results = [

        {

            "company":
                "Harmony Wellness Store",

            "contact":
                "Sarah Miller",

            "email":
                "sarah@harmonywellness.example",

            "phone":
                "+1 555-1001",

            "country":
                country or "USA",

            "interest":
                "Singing Bowls",

            "source":
                "Search",

            "score":
                92,

            "contacted":
                False

        },

        {

            "company":
                "Zen Meditation Supplies",

            "contact":
                "Michael Chen",

            "email":
                "michael@zenmeditation.example",

            "phone":
                "+1 555-1002",

            "country":
                country or "USA",

            "interest":
                "Meditation Bowls",

            "source":
                "Search",

            "score":
                89,

            "contacted":
                False

        },

        {

            "company":
                "Sacred Sound Imports",

            "contact":
                "Emma Wilson",

            "email":
                "emma@sacredsound.example",

            "phone":
                "+1 555-1003",

            "country":
                country or "USA",

            "interest":
                "Tibetan Singing Bowls",

            "source":
                "Search",

            "score":
                86,

            "contacted":
                False

        }

    ]


    results = mock_results[
        :limit
    ]


    return jsonify({

        "success": True,

        "query":
            query,

        "country":
            country,

        "count":
            len(results),

        "leads":
            results

    })


@app.route("/leads/bulk-send", methods=["POST"])
def bulk_send():

    data = request.get_json() or {}

    lead_ids = data.get("leadIds", [])
    subject = data.get("subject", "")
    message = data.get("message", "")

    leads = load_leads()

    sent = []
    failed = []

    for lead_id in lead_ids:

        lead = next(
            (
                lead for lead in leads
                if lead.get("id") == lead_id
            ),
            None
        )

        if not lead:

            failed.append({
                "id": lead_id,
                "message": "Lead not found."
            })

            continue

        try:

            send_email(
                lead["email"],
                subject,
                message
            )

            lead["contacted"] = True

            sent.append(lead)

        except Exception as error:

            print(
                f"Bulk email failed for "
                f"{lead.get('email')}: {error}"
            )

            failed.append({
                "id": lead_id,
                "email": lead.get("email"),
                "message": str(error)
            })

    save_leads(leads)

    return jsonify({
        "success": True,
        "message": "Bulk email process completed.",
        "sent": sent,
        "failed": failed,
        "sentCount": len(sent),
        "failedCount": len(failed)
    })

# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )