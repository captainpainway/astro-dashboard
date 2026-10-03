import { buildForecast } from './engine/forecast'
import { buildOutlook } from './engine/outlook'
import { buildLunar } from './engine/lunar'
import { buildTonight } from './engine/tonight'

export { clearWeatherCache } from './engine/nws'

/** Tonight's ranked plan (or the sky at `at`), computed in the browser for `location`. */
export const fetchTonight = ({ at, include, location } = {}) => buildTonight(location, { at, include })

/** Hourly conditions for one night, computed in the browser for `location`. */
export const fetchForecast = ({ date, location } = {}) => buildForecast(location, { date })

/** One rated row per upcoming night, computed in the browser for `location`. */
export const fetchOutlook = ({ nights, location } = {}) => buildOutlook(location, { nights })

/** Tonight's lunar feature ranking, computed in the browser for `location`. */
export const fetchLunar = async ({ location } = {}) => buildLunar(location)
