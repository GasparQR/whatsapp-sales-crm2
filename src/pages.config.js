import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Consultas from './pages/Consultas';
import Plantillas from './pages/Plantillas';
import Contactos from './pages/Contactos';


export const PAGES = {
    "Dashboard": Dashboard,
    "Pipeline": Pipeline,
    "Consultas": Consultas,
    "Plantillas": Plantillas,
    "Contactos": Contactos,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};