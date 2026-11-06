import aircraft from './aircraft.js'
import carton0201 from './carton0201.js'
import pairSte from './pairSte.js'
import pairRte from './pairRte.js'
import pairWindow from './pairWindow.js'
import pairHook from './pairHook.js'
import buckleNail from './buckleNail.js'
import coverBasset from './coverBasset.js'
import bufferwall from './bufferwall.js'
import roofflatHandle from './roofflatHandle.js'
import displayMulti from './displayMulti.js'
import doubleDoorLock from './doubleDoorLock.js'
import tearSelfLock from './tearSelfLock.js'
import curveBox from './curveBox.js'
import flatSheet from './flatSheet.js'
import starBox from './starBox.js'

export const REA_TEMPLATES=Object.freeze([
  aircraft,carton0201,pairSte,pairRte,pairWindow,pairHook,buckleNail,
  coverBasset,bufferwall,roofflatHandle,displayMulti,doubleDoorLock,
  tearSelfLock,curveBox,flatSheet,starBox
])

export const REA_TEMPLATE_IDS=Object.freeze(REA_TEMPLATES.map(t=>t.id))
