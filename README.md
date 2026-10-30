# Siyabonga Powertrade

Online shop for Siyabonga Powertrade, Lot 20 Main Rd, Kranskop. Customers browse groceries, pin a gate on the map, and check out for delivery or collection. Staff run orders, products, and drivers from the admin. Drivers follow the pin from the driver screen.

The app is one Node server, a SQLite file, and a React storefront. There is no separate database to install.

## Run it

Node.js 22 or newer.

```bash
npm install --prefix client
```

Development (shop UI with live reload, API on port 8780):

```bash
npm start
npm run dev
```

Open http://127.0.0.1:5173

`npm start` is the API and, after a build, the shop itself. `npm run dev` is only the Vite dev server. It proxies `/api` and `/shared` to port 8780, so both processes need to be running.

Production-style, one process:

```bash
npm run build
npm start
```

Open http://127.0.0.1:8780

The first launch creates `data/store.sqlite` and prints the admin sign-in.

## Sign in

| Who | Cell | Password |
| --- | --- | --- |
| Shop admin | 0334441595 | change-me |

Change that password under Admin → Settings before anyone else uses the shop. Drivers are added under Admin → Drivers. Customers sign up from the shop with a cell number.

Orders are pay on delivery or collection (cash or card machine). Nothing is charged in the app.

## Logo

The shop uses the original Siyabonga Powertrade sign, with the navy board and the address line removed.

- `shared/img/logo.jpg` is the original photograph. Leave it in the repo.
- `shared/img/logo-clean.png` is the transparent lockup used in the header and footer.
- `shared/img/logo-clean-white.png` is the same lockup on white, used for link previews.
- `shared/img/mark.png` is the round trolley emblem, used as the favicon and where the header is too narrow for the wordmark.

The header stays navy. The logo sits on a white plate so the red and navy still read.

## Before this is a real shop

The catalogue, prices, and pack photos are a starting list so the shop can be demonstrated. Before going live, the owner should:

- Replace product photos with real pack shots, on a plain background, square, and consistent.
- Check every price, pack size, and stock count in Admin → Products. Friday specials badges on rice, flour, sugar, and oil are marked in the storefront for the lines already described as specials. They are not a separate price list.
- Confirm the phone, fax, street address, and the shop pin (latitude and longitude) in Admin → Settings.
- Confirm the delivery fee, free-delivery threshold, and delivery minimum.
- Add the people who actually drive, and change the admin password.
- Decide opening hours and put them somewhere customers can see them. The app does not invent hours.
- The standalone file `Siyabonga Powertrade_ online store preview.html` is an earlier prototype. The shop customers should use is this app.
