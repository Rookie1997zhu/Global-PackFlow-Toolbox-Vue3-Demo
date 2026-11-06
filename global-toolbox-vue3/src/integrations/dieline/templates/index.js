import mailerFlip from './mailerFlip.js'
import fefco0201 from './fefco0201.js'
import fefco0427 from './fefco0427.js'
import tuckEndStraight from './tuckEndStraight.js'
import tuckEndReverse from './tuckEndReverse.js'
import autoLockBottom from './autoLockBottom.js'
import lidBase from './lidBase.js'
import sleeve from './sleeve.js'
import drawerTray from './drawerTray.js'
import tuckWindow from './tuckWindow.js'
import mailerAircraft from './mailerAircraft.js'
import hangingTuck from './hangingTuck.js'
import pizzaClamshell from './pizzaClamshell.js'
import handleBox from './handleBox.js'
import magneticRigid from './magneticRigid.js'
import displayPdq from './displayPdq.js'
import zipperTuck from './zipperTuck.js'
import polygonTray from './polygonTray.js'
import cylinderBox from './cylinderBox.js'
import sleeveDrawer from './sleeveDrawer.js'
import {REA_TEMPLATES} from './rea/index.js'
import {SPEC_TEMPLATES} from './spec/index.js'

export const TEMPLATES=Object.freeze(Object.fromEntries(
  [
    mailerFlip,fefco0427,fefco0201,tuckEndStraight,tuckEndReverse,autoLockBottom,lidBase,
    sleeve,drawerTray,sleeveDrawer,cylinderBox,tuckWindow,mailerAircraft,hangingTuck,pizzaClamshell,
    handleBox,magneticRigid,displayPdq,zipperTuck,polygonTray,
    ...REA_TEMPLATES,
    ...SPEC_TEMPLATES
  ].map(t=>[t.id,t])
))
export const TEMPLATE_LIST=Object.freeze(Object.values(TEMPLATES))
export const DEFAULT_TEMPLATE_ID=mailerFlip.id

/** 未知 id 回落到默认模板，调用方可通过 knife.template 确认实际使用的模板 */
export function getTemplate(id){
  return TEMPLATES[id]||TEMPLATES[DEFAULT_TEMPLATE_ID]
}
