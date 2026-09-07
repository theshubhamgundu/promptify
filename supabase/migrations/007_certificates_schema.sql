-- Migration 007: Certificates Schema

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id TEXT UNIQUE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    event_name TEXT NOT NULL,
    members_detail JSONB NOT NULL DEFAULT '[]'::jsonb,
    certificate_type TEXT NOT NULL CHECK (certificate_type IN ('TOP_10', 'TOP_20', 'PARTICIPATION')),
    rank INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED', 'REVOKED')),
    verification_url TEXT NOT NULL,
    qr_code_data_url TEXT,
    issued_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_event_team_certificate UNIQUE (event_id, team_id)
);

-- Index for fast lookup by certificate_id
CREATE INDEX IF NOT EXISTS idx_certificates_cert_id ON certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_event_team ON certificates(event_id, team_id);

-- Trigger for updated_at
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
