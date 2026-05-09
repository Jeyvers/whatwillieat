# what will i eat?

A Pinterest-style African food library. Browse, save, and contribute dishes from across the continent.

## What it does

- **Browse** a masonry grid of African dishes, combos, and snacks
- **Filter** by category (soups, swallow, grains, street food, etc.)
- **Search** by name, country, or tag
- **Add** foods with an image, description, and tags
- **Save** your favourite dishes to a personal list (requires account)
- **Contribute recipes** — anyone can add recipe URLs to any dish
- **Similar dishes** are suggested at the bottom of every detail page
- **Infinite scroll** — more foods load as you scroll down

## Stack

- Vanilla HTML / CSS / JavaScript — no build step
- [Supabase](https://supabase.com) for database and auth
- [Unicons](https://iconscout.com/unicons) for icons
- [Syne + Syncopate](https://fonts.google.com) from Google Fonts

## Project structure

```
index.html   — markup and layout
style.css    — all styles
app.js       — all logic (Supabase client, rendering, auth, forms)
fav.png      — favicon
```

## Supabase setup

Two tables are required:

**`foods`**
| column | type |
|---|---|
| id | uuid (primary key, default gen_random_uuid()) |
| name | text |
| country | text |
| type | text |
| tags | text[] |
| img_url | text |
| description | text |
| recipes | text[] |
| added_by | uuid (references auth.users) |
| created_at | timestamptz (default now()) |

**`saved_foods`**
| column | type |
|---|---|
| user_id | uuid (references auth.users) |
| food_id | uuid (references foods.id) |

Enable Row Level Security and add policies so:
- Anyone can read `foods`
- Authenticated users can insert into `foods`
- Authenticated users can read/insert/delete their own rows in `saved_foods`
- Anyone can update the `recipes` column on `foods`

## Running locally

Open `index.html` directly in a browser — no server needed.

> The Supabase SDK is loaded from jsDelivr CDN so an internet connection is required.
