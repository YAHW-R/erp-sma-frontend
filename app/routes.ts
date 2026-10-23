import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("sin-empresa", "routes/sin-empresa.tsx"),
  route("/", "routes/app.tsx", [
    index("routes/inicio.tsx"),
    route("periodos", "routes/periodos.tsx"),
    route("catalogo", "routes/catalogo.tsx"),
    route("asientos", "routes/asientos.tsx"),
    route("asientos/nuevo", "routes/asiento-nuevo.tsx"),
    route("asientos/:id", "routes/asiento-detalle.tsx"),
    route("reportes", "routes/reportes.tsx"),
    route("banco", "routes/banco.tsx"),
    route("banco/:id", "routes/extracto.tsx"),
  ]),
] satisfies RouteConfig;
