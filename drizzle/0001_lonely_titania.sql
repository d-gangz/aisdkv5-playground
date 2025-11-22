CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"text_text" text,
	"reasoning_text" text,
	"file_media_type" varchar(100),
	"file_filename" varchar(255),
	"file_url" varchar(2048),
	"source_url_source_id" varchar(255),
	"source_url_url" varchar(2048),
	"source_url_title" varchar(500),
	"source_document_source_id" varchar(255),
	"source_document_media_type" varchar(100),
	"source_document_title" varchar(500),
	"source_document_filename" varchar(255),
	"provider_metadata" jsonb,
	CONSTRAINT "text_text_required_if_type_is_text" CHECK (CASE WHEN "parts"."type" = 'text' THEN "parts"."text_text" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "reasoning_text_required_if_type_is_reasoning" CHECK (CASE WHEN "parts"."type" = 'reasoning' THEN "parts"."reasoning_text" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "file_fields_required_if_type_is_file" CHECK (CASE WHEN "parts"."type" = 'file' THEN "parts"."file_media_type" IS NOT NULL AND "parts"."file_url" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "source_url_fields_required" CHECK (CASE WHEN "parts"."type" = 'source_url' THEN "parts"."source_url_source_id" IS NOT NULL AND "parts"."source_url_url" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "source_document_fields_required" CHECK (CASE WHEN "parts"."type" = 'source_document' THEN "parts"."source_document_source_id" IS NOT NULL AND "parts"."source_document_media_type" IS NOT NULL AND "parts"."source_document_title" IS NOT NULL ELSE TRUE END)
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "role" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parts_message_id_idx" ON "parts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "parts_message_id_order_idx" ON "parts" USING btree ("message_id","order");--> statement-breakpoint
CREATE INDEX "messages_chat_id_idx" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "messages_chat_id_created_at_idx" ON "messages" USING btree ("chat_id","created_at");--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content";