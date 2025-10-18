# Master Key API Documentation

This documentation explains how to use the Master Key for server-to-server integrations.

## Authentication

To authenticate, you must include the `Authorization` and `X-Company-ID` headers in your requests.

- **Authorization**: `Bearer YOUR_MASTER_KEY`
- **X-Company-ID**: The public ID of the company you want to interact with.

Replace `YOUR_MASTER_KEY` with the key from your environment variables.

---

## Endpoints

Below are examples of how to interact with the API using the Master Key.

### Quotes

#### 1. List All Quotes for a Company

- **Endpoint**: `GET /api/companies/{companyId}/quotes`
- **Description**: Retrieves a list of all quotes for a specific company.

**Example using cURL:**
```bash
curl -X GET \
  http://localhost:3000/api/companies/COMPANY_PUBLIC_ID/quotes \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'X-Company-ID: COMPANY_PUBLIC_ID'
```

#### 2. Update a Quote's Status

- **Endpoint**: `PUT /api/companies/{companyId}/quotes/{quoteId}/status`
- **Description**: Updates the status of a specific quote.

**Example using cURL:**
```bash
curl -X PUT \
  http://localhost:3000/api/companies/COMPANY_PUBLIC_ID/quotes/QUOTE_PUBLIC_ID/status \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'X-Company-ID: COMPANY_PUBLIC_ID' \
  -H 'Content-Type: application/json' \
  -d '{
        "status": "sent"
      }'
```
Valid statuses are `draft`, `sent`, `accepted`, and `rejected`.

### Clients

#### 1. List All Clients for a Company

- **Endpoint**: `GET /api/companies/{companyId}/clients`
- **Description**: Retrieves a list of all clients for a specific company.

**Example using cURL:**
```bash
curl -X GET \
  http://localhost:3000/api/companies/COMPANY_PUBLIC_ID/clients \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'X-Company-ID: COMPANY_PUBLIC_ID'
```

#### 2. Create a New Client

- **Endpoint**: `POST /api/companies/{companyId}/clients`
- **Description**: Creates a new client for a specific company.

**Example using cURL:**
```bash
curl -X POST \
  http://localhost:3000/api/companies/COMPANY_PUBLIC_ID/clients \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'X-Company-ID: COMPANY_PUBLIC_ID' \
  -H 'Content-Type: application/json' \
  -d '{
        "name": "New Client Name",
        "email": "client@example.com",
        "phone": "123456789"
      }'
```
