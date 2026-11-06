import specData from '../../catalog/structureSpecs.js'
import {createSpecTemplate} from './specTemplate.js'

export const SPEC_TEMPLATES=Object.freeze((specData?.specs||[]).map(createSpecTemplate))

export const SPEC_TEMPLATE_BY_CODE=Object.freeze(Object.fromEntries(
  SPEC_TEMPLATES.map(t=>[t.specRef.code,t.id])
))
